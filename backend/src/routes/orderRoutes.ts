import { Router, Request, Response } from 'express';
import { orderTrackerService } from '../services/orderTrackerService';

const router = Router();

// GET /api/orders
router.get('/', async (_req: Request, res: Response) => {
  try {
    const orders = await orderTrackerService.getOrders();
    return res.json({ orders });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// POST /api/orders/add
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { store, orderId, productTitle, productImage, totalAmount } = req.body;
    if (!store || !orderId) {
      return res.status(400).json({ error: 'store and orderId are required' });
    }

    const order = await orderTrackerService.trackAndSaveOrder({
      store,
      orderId,
      productTitle,
      productImage,
      totalAmount
    });

    return res.json({ success: true, order });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to add order' });
  }
});

// POST /api/orders/parse-message
router.post('/parse-message', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'text field is required' });
    }

    const parsed = orderTrackerService.parseOrderText(text);
    if (!parsed) {
      return res.status(404).json({
        error: 'Could not extract an Amazon, Flipkart, or Meesho Order ID from the text provided.'
      });
    }

    const order = await orderTrackerService.trackAndSaveOrder({
      store: parsed.store,
      orderId: parsed.orderId,
      productTitle: `${parsed.store.toUpperCase()} Item (${parsed.orderId})`,
      totalAmount: parsed.amount
    });

    return res.json({ success: true, parsed, order });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to parse order message' });
  }
});

export default router;
