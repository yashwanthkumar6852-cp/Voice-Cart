import { Router, Request, Response } from 'express';
import { razorpayService } from '../services/razorpayService';
import { dbClient } from '../db/dbClient';
import { CartItem, OrderRecord } from '../types/product';
import { config } from '../config';

const router = Router();

// GET /api/payments/config - Public configuration (never expose secrets)
router.get('/config', (_req: Request, res: Response) => {
  return res.json({
    success: true,
    ...razorpayService.getConfig()
  });
});

// POST /api/payments/create-order
// Guard: Razorpay payment is strictly restricted to items marked ownStore=true (or store: 'voicecart')
router.post('/create-order', async (req: Request, res: Response) => {
  try {
    const { items, notes, receiptId } = req.body;

    // 1. Fetch current cart from DB or provided items
    let cartItems: CartItem[] = [];
    if (items && Array.isArray(items) && items.length > 0) {
      cartItems = items;
    } else {
      cartItems = await dbClient.getCart();
    }

    // 2. Strict Filter: ONLY calculate amount for VoiceCart own-store items!
    // Items from Amazon, Flipkart or Meesho must NEVER be charged through Razorpay.
    const ownStoreItems = cartItems.filter(
      (item) => item.product.store === 'voicecart' || item.isOwnStore === true
    );

    if (ownStoreItems.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Razorpay payment is allowed only for VoiceCart own-store items. Items from partner stores (Amazon, Flipkart, Meesho) must be checked out via official partner store links.'
      });
    }

    // 3. Amount calculated strictly on server in INR (converted to paise in razorpayService)
    const calculatedAmount = ownStoreItems.reduce(
      (sum, item) => sum + Number(item.currentPrice || item.product.price) * Number(item.quantity || 1),
      0
    );

    if (calculatedAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid order amount calculated.'
      });
    }

    const orderReceipt = receiptId || `vc_rcpt_${Date.now()}`;
    const orderNotes = {
      ...(notes || {}),
      itemCount: String(ownStoreItems.length),
      platform: 'VoiceCart Live Web',
      paymentMode: config.razorpay.mode
    };

    // 4. Create Razorpay order (amount in paise calculated on server)
    const razorpayOrder = await razorpayService.createOrder(
      calculatedAmount,
      orderReceipt,
      orderNotes
    );

    // 5. Save preliminary Order in DB
    const internalOrderId = `VC-DIR-${Date.now().toString().slice(-6)}`;
    const productTitle = ownStoreItems.map(i => `${i.product.title} (x${i.quantity})`).join(', ');
    const productImage = ownStoreItems[0]?.product.imageUrl || '';

    const newOrder: OrderRecord = {
      id: razorpayOrder.id || `order_${Date.now()}`,
      orderId: internalOrderId,
      store: 'voicecart',
      productTitle,
      productImage,
      totalAmount: calculatedAmount,
      status: 'CREATED',
      orderedAt: new Date().toISOString(),
      estimatedDeliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }),
      trackingUrl: `/orders?id=${internalOrderId}`,
      storeUrl: `/orders?id=${internalOrderId}`,
      paymentOrderId: razorpayOrder.id,
      paymentMode: config.razorpay.mode,
      items: ownStoreItems,
      timeline: [
        {
          stage: 'Payment Initiated',
          description: `Razorpay Order ${razorpayOrder.id} created for ₹${calculatedAmount.toLocaleString()}`,
          timestamp: new Date().toISOString(),
          completed: true
        },
        {
          stage: 'Payment Verification',
          description: 'Awaiting customer completion and HMAC signature verification',
          timestamp: new Date().toISOString(),
          completed: false
        },
        {
          stage: 'Order Confirmed',
          description: 'Inventory allocated at VoiceCart Express Warehouse',
          timestamp: '',
          completed: false
        },
        {
          stage: 'Out for Delivery',
          description: 'Dispatched via Express Courier',
          timestamp: '',
          completed: false
        },
        {
          stage: 'Delivered',
          description: 'Package delivered with OTP confirmation',
          timestamp: '',
          completed: false
        }
      ]
    };

    await dbClient.saveOrder(newOrder);

    return res.json({
      success: true,
      order: razorpayOrder,
      keyId: config.razorpay.keyId,
      calculatedAmount,
      internalOrderId,
      paymentMode: config.razorpay.mode,
      isTestMode: config.razorpay.isTestMode
    });
  } catch (error: any) {
    console.error('Razorpay order creation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create payment order',
      details: error.message
    });
  }
});

// POST /api/payments/verify
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, method } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing razorpay_order_id or razorpay_payment_id'
      });
    }

    // 1. Verify HMAC SHA256 Signature
    const isValid = razorpayService.verifyPaymentSignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature || ''
    );

    if (!isValid) {
      console.warn(`❌ Invalid Razorpay signature for order ${razorpay_order_id}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid payment signature verification failed.'
      });
    }

    // 2. Fetch existing order and mark as PAID
    let existingOrder = await dbClient.getOrderById(razorpay_order_id);
    const nowIso = new Date().toISOString();

    if (!existingOrder) {
      const allOrders = await dbClient.getOrders();
      existingOrder = allOrders.find(o => o.paymentOrderId === razorpay_order_id) || null;
    }

    if (existingOrder) {
      existingOrder.status = 'PAID';
      existingOrder.paymentId = razorpay_payment_id;
      existingOrder.paymentMethod = method || 'Razorpay Checkout (UPI/Cards)';
      existingOrder.paidAt = nowIso;
      
      // Update timeline
      if (existingOrder.timeline[1]) {
        existingOrder.timeline[1].completed = true;
        existingOrder.timeline[1].timestamp = nowIso;
      }
      if (existingOrder.timeline[2]) {
        existingOrder.timeline[2].completed = true;
        existingOrder.timeline[2].timestamp = nowIso;
      }

      await dbClient.saveOrder(existingOrder);
    }

    // 3. Clear own-store items from user cart
    const currentCart = await dbClient.getCart();
    for (const item of currentCart) {
      if (item.product.store === 'voicecart' || item.isOwnStore === true) {
        await dbClient.removeCartItem(item.id);
      }
    }

    console.log(`✅ Razorpay Payment verified successfully: Order ${razorpay_order_id}, Payment ${razorpay_payment_id}`);

    return res.json({
      success: true,
      message: 'Payment verified successfully.',
      order: existingOrder,
      paymentId: razorpay_payment_id,
      orderId: existingOrder?.orderId || razorpay_order_id,
      amount: existingOrder?.totalAmount || 0,
      paymentMode: config.razorpay.mode,
      paidAt: nowIso
    });
  } catch (error: any) {
    console.error('Payment verification error:', error);
    return res.status(500).json({
      success: false,
      error: 'Verification processing failed',
      details: error.message
    });
  }
});

// POST /api/payments/webhook - Idempotent Webhook Handler
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const signature = (req.headers['x-razorpay-signature'] as string) || '';
    const rawBody = (req as any).rawBody || JSON.stringify(req.body);

    const isValid = razorpayService.verifyWebhookSignature(rawBody, signature);
    if (!isValid) {
      console.warn('⚠️ Webhook signature validation failed.');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }

    const event = req.body;
    const eventType = event.event;
    console.log(`🔔 Razorpay Webhook received event: ${eventType}`);

    if (eventType === 'payment.captured' || eventType === 'order.paid') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;

      if (orderId) {
        let order = await dbClient.getOrderById(orderId);
        if (!order) {
          const allOrders = await dbClient.getOrders();
          order = allOrders.find(o => o.paymentOrderId === orderId) || null;
        }

        // Idempotent: process only if not already marked PAID
        if (order && order.status !== 'PAID') {
          order.status = 'PAID';
          order.paymentId = paymentEntity?.id || order.paymentId;
          order.paidAt = new Date().toISOString();
          order.paymentMethod = paymentEntity?.method ? `Razorpay (${paymentEntity.method.toUpperCase()})` : 'Razorpay Webhook';
          
          if (order.timeline[1]) {
            order.timeline[1].completed = true;
            order.timeline[1].timestamp = order.paidAt;
          }
          if (order.timeline[2]) {
            order.timeline[2].completed = true;
            order.timeline[2].timestamp = order.paidAt;
          }

          await dbClient.saveOrder(order);
          console.log(`✅ Order ${orderId} marked as PAID via webhook event ${eventType}`);
        }
      }
    } else if (eventType === 'payment.failed') {
      const paymentEntity = event.payload?.payment?.entity;
      const orderId = paymentEntity?.order_id;
      if (orderId) {
        let order = await dbClient.getOrderById(orderId);
        if (!order) {
          const allOrders = await dbClient.getOrders();
          order = allOrders.find(o => o.paymentOrderId === orderId) || null;
        }

        if (order && order.status !== 'PAID') {
          order.status = 'FAILED';
          order.timeline.push({
            stage: 'Payment Failed',
            description: paymentEntity?.error_description || 'Payment was declined by bank/gateway',
            timestamp: new Date().toISOString(),
            completed: true
          });
          await dbClient.saveOrder(order);
          console.log(`⚠️ Order ${orderId} marked as FAILED via webhook`);
        }
      }
    }

    return res.json({ status: 'ok', received: true });
  } catch (error: any) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing error', details: error.message });
  }
});

// GET /api/payments/status/:orderId - Payment Status Poller
router.get('/status/:orderId', async (req: Request, res: Response) => {
  try {
    const orderId = String(req.params.orderId || '');
    if (!orderId) {
      return res.status(400).json({ error: 'orderId parameter is required' });
    }

    let order = await dbClient.getOrderById(orderId);
    if (!order) {
      const allOrders = await dbClient.getOrders();
      order = allOrders.find(o => o.paymentOrderId === orderId || o.orderId.toLowerCase() === orderId.toLowerCase()) || null;
    }

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    return res.json({
      success: true,
      orderId: order.orderId,
      status: order.status,
      isPaid: order.status === 'PAID' || order.status === 'ORDERED' || order.status === 'PACKED' || order.status === 'SHIPPED',
      paymentId: order.paymentId,
      paymentMethod: order.paymentMethod,
      totalAmount: order.totalAmount,
      paidAt: order.paidAt,
      paymentMode: order.paymentMode,
      order
    });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to poll order status', details: error.message });
  }
});

// POST /api/payments/refund - Refund for Order / Failed Fulfilment
router.post('/refund', async (req: Request, res: Response) => {
  try {
    const { orderId, paymentId, reason, amount } = req.body;
    if (!orderId && !paymentId) {
      return res.status(400).json({ error: 'orderId or paymentId is required for refund' });
    }

    let order = orderId ? await dbClient.getOrderById(orderId) : null;
    if (!order && orderId) {
      const allOrders = await dbClient.getOrders();
      order = allOrders.find(o => o.paymentOrderId === orderId || o.orderId.toLowerCase() === orderId.toLowerCase()) || null;
    }

    const targetPaymentId = paymentId || order?.paymentId;

    if (!targetPaymentId) {
      return res.status(400).json({ error: 'No associated paymentId found to execute refund.' });
    }

    const refundAmountInr = amount ? Number(amount) : order?.totalAmount;
    const refundResult = await razorpayService.refundPayment(
      targetPaymentId,
      refundAmountInr,
      { reason: reason || 'VoiceCart customer cancellation / fulfilment refund' }
    );

    if (order) {
      order.status = 'CANCELLED';
      order.timeline.push({
        stage: 'Refund Processed',
        description: `Refund of ₹${refundAmountInr?.toLocaleString()} processed to original payment method (Refund ID: ${refundResult.id})`,
        timestamp: new Date().toISOString(),
        completed: true
      });
      await dbClient.saveOrder(order);
    }

    return res.json({
      success: true,
      message: 'Refund initiated successfully',
      refund: refundResult,
      order
    });
  } catch (err: any) {
    console.error('Refund processing error:', err);
    return res.status(500).json({
      error: 'Refund failed',
      details: err.message
    });
  }
});

// GET /api/payments/admin/orders - Admin Order Listing
router.get('/admin/orders', async (_req: Request, res: Response) => {
  try {
    const orders = await dbClient.getOrders();
    return res.json({ success: true, orders });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to list admin orders', details: err.message });
  }
});

export default router;
