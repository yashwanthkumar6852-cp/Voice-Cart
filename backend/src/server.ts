import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import searchRoutes from './routes/searchRoutes';
import voiceRoutes from './routes/voiceRoutes';
import cartRoutes from './routes/cartRoutes';
import orderRoutes from './routes/orderRoutes';
import paymentRoutes from './routes/paymentRoutes';

const app = express();

// Rate limiter: 100 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please slow down.' }
});

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({
  limit: '5mb',
  verify: (req: any, _res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', apiLimiter);

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'VoiceCart Backend API',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    providers: {
      amazon: config.amazon.isEnabled,
      flipkart: config.flipkart.isEnabled,
      meesho: config.meesho.isEnabled,
      razorpay: config.razorpay.isEnabled
    },
    speechProviders: {
      sarvam: config.speechProviders.sarvam,
      groq: config.speechProviders.groq,
      gemini: config.speechProviders.gemini,
      webSpeech: true
    },
    paymentMode: config.razorpay.mode
  });
});

// API Routes
app.use('/api/search', searchRoutes);
app.use('/api/voice', voiceRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/payments', paymentRoutes);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error'
  });
});

const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`
  🎙️  ======================================================
     VOICECART BACKEND API STARTED ON PORT ${PORT}
     Environment : ${config.nodeEnv}
     Health Check: http://localhost:${PORT}/health
     Providers   : Amazon (${config.amazon.isEnabled ? 'Active' : 'Unset'}), Flipkart (${config.flipkart.isEnabled ? 'Active' : 'Unset'}), Meesho (${config.meesho.isEnabled ? 'Partner Feed' : 'Not Available'})
  ======================================================
  `);
});

export default app;
