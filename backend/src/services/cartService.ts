import { v4 as uuidv4 } from 'uuid';
import { dbClient } from '../db/dbClient';
import { aggregatorService } from '../providers/aggregatorService';
import { CartItem, Product } from '../types/product';

export class CartService {
  public async getCart(): Promise<CartItem[]> {
    return dbClient.getCart();
  }

  public async addToCart(product: Product, quantity = 1): Promise<CartItem> {
    const existingItems = await dbClient.getCart();
    const existing = existingItems.find(
      (item) => item.product.productId === product.productId && item.product.store === product.store
    );

    if (existing) {
      existing.quantity += quantity;
      existing.currentPrice = product.price;
      return dbClient.saveCartItem(existing);
    }

    const newItem: CartItem = {
      id: uuidv4(),
      product,
      quantity,
      addedPrice: product.price,
      currentPrice: product.price,
      priceChanged: false,
      priceDelta: 0,
      addedAt: new Date().toISOString()
    };

    return dbClient.saveCartItem(newItem);
  }

  public async removeFromCart(id: string): Promise<boolean> {
    return dbClient.removeCartItem(id);
  }

  public async clearCart(): Promise<void> {
    return dbClient.clearCart();
  }

  /**
   * Re-checks live prices across Amazon, Flipkart, and Meesho before checkout.
   * Identifies any price drops or increases.
   */
  public async verifyLivePrices(): Promise<{
    items: CartItem[];
    hasPriceChanges: boolean;
    totalSavingsOrIncrease: number;
  }> {
    const items = await dbClient.getCart();
    let hasPriceChanges = false;
    let totalSavingsOrIncrease = 0;

    for (const item of items) {
      try {
        const liveProduct = await aggregatorService.getProductLive(item.product.store, item.product.productId);
        if (liveProduct && liveProduct.price > 0) {
          const delta = liveProduct.price - item.addedPrice;
          item.currentPrice = liveProduct.price;
          item.priceChanged = delta !== 0;
          item.priceDelta = delta;
          totalSavingsOrIncrease += delta * item.quantity;
          if (delta !== 0) hasPriceChanges = true;
          await dbClient.saveCartItem(item);
        }
      } catch (err) {
        console.warn(`Could not verify live price for item ${item.product.productId}`);
      }
    }

    return {
      items,
      hasPriceChanges,
      totalSavingsOrIncrease
    };
  }
}

export const cartService = new CartService();
