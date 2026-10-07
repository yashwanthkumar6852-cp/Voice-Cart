import { Router, Request, Response } from 'express';
import { cartService } from '../services/cartService';

const router = Router();

// GET /api/cart
router.get('/', async (_req: Request, res: Response) => {
  try {
    const items = await cartService.getCart();
    return res.json({ items });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to fetch cart' });
  }
});

// POST /api/cart/add
router.post('/add', async (req: Request, res: Response) => {
  try {
    const { product, quantity } = req.body;
    if (!product || !product.productId || !product.store) {
      return res.status(400).json({ error: 'Valid product object is required' });
    }
    const item = await cartService.addToCart(product, quantity || 1);
    const cart = await cartService.getCart();
    return res.json({ item, cart });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to add item to cart' });
  }
});

// DELETE /api/cart/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await cartService.removeFromCart(id as string);
    const cart = await cartService.getCart();
    return res.json({ success: true, cart });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to delete item from cart' });
  }
});

// POST /api/cart/verify-prices
router.post('/verify-prices', async (_req: Request, res: Response) => {
  try {
    const verification = await cartService.verifyLivePrices();
    return res.json(verification);
  } catch (error: any) {
    return res.status(500).json({ error: 'Price verification failed' });
  }
});

// DELETE /api/cart
router.delete('/', async (_req: Request, res: Response) => {
  try {
    await cartService.clearCart();
    return res.json({ success: true, items: [] });
  } catch (error: any) {
    return res.status(500).json({ error: 'Failed to clear cart' });
  }
});

export default router;
