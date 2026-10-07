import { Router, Request, Response } from 'express';
import multer from 'multer';
import { intentParser } from '../voice/intentParser';
import { voiceService } from '../services/voiceService';
import { transcriptionService } from '../voice/transcriptionService';
import { aggregatorService } from '../providers/aggregatorService';
import { rankingEngine } from '../ranking/rankingEngine';
import { cartService } from '../services/cartService';
import { orderTrackerService } from '../services/orderTrackerService';
import { config } from '../config';

const router = Router();

// Configure multer with memory storage & 10MB size limit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max audio clip limit
  }
});

// POST /api/voice/transcribe
// Supports multipart/form-data (audio/file) and application/json (audioBase64)
// Tiers: Sarvam AI (Saaras v3) -> Groq Whisper (whisper-large-v3) -> Gemini Multimodal Audio
router.post('/transcribe', upload.single('audio'), async (req: Request, res: Response) => {
  try {
    let audioBuffer: Buffer | null = null;
    let mimeType = 'audio/webm';
    const requestedLang = (req.body.lang || req.body.language || 'en-IN') as string;

    if (req.file && req.file.buffer) {
      audioBuffer = req.file.buffer;
      mimeType = req.file.mimetype || 'audio/webm';
    } else if (req.body.audioBase64) {
      audioBuffer = Buffer.from(req.body.audioBase64, 'base64');
      mimeType = req.body.mimeType || 'audio/webm';
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      return res.status(400).json({
        error: 'No audio provided. Upload multipart file "audio" or pass "audioBase64" JSON string.'
      });
    }

    const result = await transcriptionService.transcribeAudio(audioBuffer, mimeType, requestedLang);

    return res.json({
      success: true,
      text: result.text,
      transcript: result.text,
      provider: result.provider,
      lang: result.lang,
      durationMs: result.durationMs
    });
  } catch (err: any) {
    console.error('Audio transcription error:', err.message);
    return res.status(500).json({
      error: 'Audio transcription failed',
      details: err.message || 'All speech providers failed'
    });
  }
});

// POST /api/voice/process
// Body: { transcript: string, context?: any }
router.post('/process', async (req: Request, res: Response) => {
  try {
    const { transcript, context } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ error: 'Field "transcript" is required' });
    }

    const intentResult = await intentParser.parseIntent(transcript, context);
    const voiceConfig = voiceService.getVoiceConfig(intentResult.language);

    let searchData: any = null;
    let cartData: any = null;
    let orderData: any = null;

    // Handle intent executions
    if (intentResult.intent === 'SEARCH' || intentResult.intent === 'COMPARE') {
      const query = intentResult.productQuery || transcript;
      const filters = {
        maxBudget: intentResult.maxBudget,
        brand: intentResult.brand,
        preference: intentResult.preference || 'balanced'
      };

      const { products, storeStatuses } = await aggregatorService.searchAllStores(query, filters);
      const ranked = rankingEngine.rank(products, filters, storeStatuses);

      searchData = {
        query,
        filters,
        products: ranked.rankedProducts,
        topRecommendations: ranked.topRecommendations,
        comparisonMatrix: ranked.comparisonMatrix,
        storeStatuses
      };

      // Enrich spoken response if top item was found
      if (ranked.topRecommendations.bestOverall) {
        const top = ranked.topRecommendations.bestOverall;
        const totalCost = top.price + top.shippingFee;
        const storeName = top.store === 'amazon' ? 'Amazon' : top.store === 'flipkart' ? 'Flipkart' : 'Meesho';

        if (intentResult.language === 'hi') {
          intentResult.spokenResponse = `सबसे अच्छा विकल्प ${storeName} पर ₹${totalCost} में ${top.title.slice(0, 30)} है। क्या मैं इसे कार्ट में जोड़ दूँ?`;
        } else if (intentResult.language === 'kn') {
          intentResult.spokenResponse = `ಅತ್ಯುತ್ತಮ ಆಯ್ಕೆ ${storeName} ನಲ್ಲಿ ₹${totalCost} ಕ್ಕೆ ಲಭ್ಯವಿದೆ. ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಲೇ?`;
        } else {
          intentResult.spokenResponse = `Found the best option on ${storeName} for ₹${totalCost} (${top.rating}★ rating). Would you like to add it to your cart or view store details?`;
        }
      }
    } else if (intentResult.intent === 'ADD_TO_CART') {
      if (context?.selectedProduct) {
        const item = await cartService.addToCart(context.selectedProduct);
        cartData = { addedItem: item, cart: await cartService.getCart() };
      }
    } else if (intentResult.intent === 'VIEW_CART') {
      cartData = { cart: await cartService.getCart() };
    } else if (intentResult.intent === 'TRACK_ORDER') {
      const latest = intentResult.orderId 
        ? await orderTrackerService.getOrderById(intentResult.orderId)
        : await orderTrackerService.getLatestOrder();

      if (latest) {
        orderData = latest;
        if (intentResult.language === 'hi') {
          intentResult.spokenResponse = `आपका ${latest.store.toUpperCase()} आर्डर #${latest.orderId} स्थिति ${latest.status} में है।`;
        } else if (intentResult.language === 'kn') {
          intentResult.spokenResponse = `ನಿಮ್ಮ ${latest.store.toUpperCase()} ಆರ್ಡರ್ #${latest.orderId} ಸ್ಥಿತಿ: ${latest.status}.`;
        } else {
          intentResult.spokenResponse = `Your ${latest.store.toUpperCase()} order #${latest.orderId} is currently ${latest.status.replace(/_/g, ' ')}. Expected delivery in 2 days.`;
        }
      } else {
        intentResult.spokenResponse = intentResult.language === 'kn' ? "ಯಾವುದೇ ಸಕ್ರಿಯ ಆರ್ಡರ್‌ಗಳು ಕಂಡುಬಂದಿಲ್ಲ." : "No active orders found. You can paste an order confirmation message to start tracking.";
      }
    }

    return res.json({
      intentResult,
      voiceConfig,
      searchData,
      cartData,
      orderData
    });
  } catch (error: any) {
    console.error('Voice process route error:', error);
    return res.status(500).json({ error: 'Voice processing failed', details: error.message });
  }
});

export default router;
