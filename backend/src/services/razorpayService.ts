import crypto from 'crypto';
import Razorpay from 'razorpay';
import { config } from '../config';

export class RazorpayService {
  private razorpayInstance: Razorpay | null = null;

  constructor() {
    this.validateAndInitialize();
  }

  private validateAndInitialize() {
    // 1. Startup validation: In live mode, strictly require rzp_live_ keys
    if (config.razorpay.mode === 'live') {
      if (!config.razorpay.keyId || !config.razorpay.keyId.startsWith('rzp_live_')) {
        console.error('❌ [FATAL] PAYMENT_MODE is set to "live" but RAZORPAY_KEY_ID does not start with "rzp_live_". Live keys are required.');
        process.exit(1);
      }
      if (!config.razorpay.keySecret) {
        console.error('❌ [FATAL] PAYMENT_MODE is set to "live" but RAZORPAY_KEY_SECRET is missing.');
        process.exit(1);
      }
    }

    if (config.razorpay.isEnabled) {
      this.razorpayInstance = new Razorpay({
        key_id: config.razorpay.keyId,
        key_secret: config.razorpay.keySecret
      });
      // Log ONLY the payment mode (never keys or secrets)
      console.log(`✅ Razorpay Direct Checkout Service Initialized [Mode: ${config.razorpay.mode.toUpperCase()}].`);
    } else {
      console.log(`ℹ️ Razorpay Direct Checkout Service Initialized [Mode: ${config.razorpay.mode.toUpperCase()} - Unconfigured Keys].`);
    }
  }

  public isEnabled(): boolean {
    return Boolean(this.razorpayInstance);
  }

  public getPaymentMode(): 'test' | 'live' {
    return config.razorpay.mode;
  }

  public getConfig() {
    return {
      isConfigured: Boolean(config.razorpay.keyId),
      keyId: config.razorpay.keyId,
      paymentMode: config.razorpay.mode,
      isTestMode: config.razorpay.isTestMode,
      upiId: config.upi.id,
      upiPayeeName: config.upi.payeeName
    };
  }

  public async createOrder(amountInInr: number, receiptId: string, notes: Record<string, string> = {}) {
    const amountInPaise = Math.round(amountInInr * 100);

    if (!this.razorpayInstance) {
      // Local fallback in test mode when keys are completely unset
      return {
        id: `order_test_${Date.now()}`,
        amount: amountInPaise,
        currency: 'INR',
        receipt: receiptId,
        status: 'created',
        keyId: config.razorpay.keyId || 'rzp_test_fallback'
      };
    }

    const options = {
      amount: amountInPaise, // amount in paise
      currency: 'INR',
      receipt: receiptId,
      notes
    };

    const order = await this.razorpayInstance.orders.create(options);
    return {
      ...order,
      keyId: config.razorpay.keyId
    };
  }

  public verifyPaymentSignature(razorpayOrderId: string, razorpayPaymentId: string, signature: string): boolean {
    if (!config.razorpay.keySecret) {
      if (config.razorpay.mode === 'live') return false;
      return true; // Fallback only in test mode when keySecret is empty
    }
    if (!signature) return false;
    const text = `${razorpayOrderId}|${razorpayPaymentId}`;
    const generated = crypto
      .createHmac('sha256', config.razorpay.keySecret)
      .update(text)
      .digest('hex');
    return generated === signature;
  }

  public verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = config.razorpay.webhookSecret;
    if (!secret) {
      if (config.razorpay.mode === 'live') return false;
      return true; // Fallback only in test mode
    }
    if (!signature) return false;
    const generated = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');
    return generated === signature;
  }

  public async fetchPayment(paymentId: string) {
    if (!this.razorpayInstance) return null;
    try {
      return await this.razorpayInstance.payments.fetch(paymentId);
    } catch (e: any) {
      console.warn('Razorpay fetchPayment error:', e.message);
      return null;
    }
  }

  public async refundPayment(paymentId: string, amountInInr?: number, notes: Record<string, string> = {}) {
    if (!this.razorpayInstance) {
      return {
        id: `rfnd_mock_${Date.now()}`,
        payment_id: paymentId,
        amount: amountInInr ? Math.round(amountInInr * 100) : 0,
        status: 'processed'
      };
    }

    const options: any = { notes };
    if (amountInInr && amountInInr > 0) {
      options.amount = Math.round(amountInInr * 100); // amount in paise
    }

    const refund = await this.razorpayInstance.payments.refund(paymentId, options);
    return refund;
  }
}

export const razorpayService = new RazorpayService();
