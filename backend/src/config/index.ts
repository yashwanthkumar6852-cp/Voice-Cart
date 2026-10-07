import dotenv from 'dotenv';
import path from 'path';

// Load .env from workspace root or current directory
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Redis & PostgreSQL
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  redisTtlSeconds: parseInt(process.env.REDIS_TTL_SECONDS || '300', 10), // 5 min cache
  databaseUrl: process.env.DATABASE_URL || '',

  // SerpApi (Live Google Shopping India for Amazon, Flipkart, Meesho)
  serpApiKey: process.env.SERPAPI_KEY || '',

  // Apify Token
  apifyToken: process.env.APIFY_TOKEN || '',

  // Amazon PA-API 5.0 & Creators Tag
  amazon: {
    accessKey: process.env.AMAZON_ACCESS_KEY || '',
    secretKey: process.env.AMAZON_SECRET_KEY || '',
    partnerTag: process.env.AMAZON_PARTNER_TAG || process.env.AMAZON_ASSOCIATE_TAG || 'voxacart-21',
    clientId: process.env.AMAZON_CLIENT_ID || '',
    clientSecret: process.env.AMAZON_CLIENT_SECRET || '',
    host: 'webservices.amazon.in',
    region: 'eu-west-1',
    marketplace: 'www.amazon.in',
    isEnabled: Boolean(process.env.AMAZON_ACCESS_KEY || process.env.SERPAPI_KEY)
  },

  // Flipkart Affiliate API
  flipkart: {
    affiliateId: process.env.FLIPKART_AFFILIATE_ID || '',
    affiliateToken: process.env.FLIPKART_AFFILIATE_TOKEN || '',
    baseUrl: 'https://affiliate-api.flipkart.net/affiliate/1.0',
    isEnabled: Boolean((process.env.FLIPKART_AFFILIATE_ID && process.env.FLIPKART_AFFILIATE_TOKEN) || process.env.SERPAPI_KEY)
  },

  // Meesho Partner & Apify Feed
  meesho: {
    partnerApiKey: process.env.MEESHO_PARTNER_API_KEY || process.env.APIFY_TOKEN || '',
    partnerEndpoint: process.env.MEESHO_PARTNER_ENDPOINT || process.env.MEESHO_FEED_URL || '',
    isEnabled: Boolean(process.env.MEESHO_PARTNER_API_KEY || process.env.MEESHO_FEED_URL || process.env.SERPAPI_KEY || process.env.APIFY_TOKEN)
  },

  // LLM Intent Parser & Voice Transcription Pipeline
  sarvamApiKey: process.env.SARVAM_API_KEY || '',
  groqApiKey: process.env.GROQ_API_KEY || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  openaiApiKey: process.env.OPENAI_API_KEY || '',
  googleSpeechApiKey: process.env.GOOGLE_SPEECH_API_KEY || '',

  speechProviders: {
    sarvam: Boolean(process.env.SARVAM_API_KEY),
    groq: Boolean(process.env.GROQ_API_KEY),
    gemini: Boolean(process.env.GEMINI_API_KEY),
    webSpeech: true
  },

  // Razorpay
  razorpay: {
    keyId: (process.env.RAZORPAY_KEY_ID || '').trim(),
    keySecret: (process.env.RAZORPAY_KEY_SECRET || '').trim(),
    webhookSecret: (process.env.RAZORPAY_WEBHOOK_SECRET || '').trim(),
    mode: ((process.env.PAYMENT_MODE || '').trim().toLowerCase() === 'live' ? 'live' : 'test') as 'test' | 'live',
    isTestMode: ((process.env.PAYMENT_MODE || '').trim().toLowerCase() !== 'live'),
    isEnabled: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
  },

  // Direct UPI Configuration (Works in test & live)
  upi: {
    id: process.env.UPI_ID || 'voicecart@oksbi',
    payeeName: process.env.UPI_PAYEE_NAME || 'VoiceCart'
  }
};
