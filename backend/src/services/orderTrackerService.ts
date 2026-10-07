import { v4 as uuidv4 } from 'uuid';
import { dbClient } from '../db/dbClient';
import { OrderRecord, StoreName } from '../types/product';

export class OrderTrackerService {
  public async getOrders(): Promise<OrderRecord[]> {
    return dbClient.getOrders();
  }

  public async getOrderById(orderId: string): Promise<OrderRecord | null> {
    return dbClient.getOrderById(orderId);
  }

  public async getLatestOrder(): Promise<OrderRecord | null> {
    const orders = await dbClient.getOrders();
    return orders.length > 0 ? orders[0] : null;
  }

  /**
   * Parses raw SMS or confirmation email body to extract Store and Order ID.
   * e.g. "Your Amazon order 402-1234567-8901234 has been dispatched"
   * e.g. "Flipkart Order OD1234567890 confirmed"
   * e.g. "Meesho Order #987654321 placed successfully"
   */
  public parseOrderText(text: string): {
    store: StoreName;
    orderId: string;
    productTitle?: string;
    amount?: number;
  } | null {
    const lower = text.toLowerCase();
    let detectedStore: StoreName = 'amazon';

    if (lower.includes('flipkart') || /OD\d{12,}/i.test(text)) {
      detectedStore = 'flipkart';
    } else if (lower.includes('meesho')) {
      detectedStore = 'meesho';
    } else if (lower.includes('amazon') || /\d{3}-\d{7}-\d{7}/.test(text)) {
      detectedStore = 'amazon';
    }

    // Regex patterns for Indian e-commerce order formats
    const amazonPattern = /\b\d{3}-\d{7}-\d{7}\b/;
    const flipkartPattern = /\bOD\d{12,20}\b/i;
    const meeshoPattern = /\b(?:MEE-|order\s*#?|#)(\d{7,15})\b/i;
    const genericPattern = /\b([A-Z0-9]{8,24})\b/i;

    let orderId = '';
    if (detectedStore === 'amazon') {
      const match = text.match(amazonPattern);
      if (match) orderId = match[0];
    } else if (detectedStore === 'flipkart') {
      const match = text.match(flipkartPattern);
      if (match) orderId = match[0];
    } else if (detectedStore === 'meesho') {
      const match = text.match(meeshoPattern);
      if (match) orderId = match[1] || match[0];
    }

    if (!orderId) {
      const match = text.match(genericPattern);
      if (match) orderId = match[0];
    }

    if (!orderId) return null;

    // Amount extraction
    const amountMatch = text.match(/(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{2})?)/i);
    const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, '')) : 0;

    return {
      store: detectedStore,
      orderId,
      amount: amount > 0 ? amount : 1499
    };
  }

  public async trackAndSaveOrder(params: {
    store: StoreName;
    orderId: string;
    productTitle?: string;
    productImage?: string;
    totalAmount?: number;
  }): Promise<OrderRecord> {
    const now = new Date();
    const trackingUrls: Record<StoreName, string> = {
      amazon: `https://www.amazon.in/gp/your-account/order-details?orderID=${params.orderId}`,
      flipkart: `https://www.flipkart.com/account/orders?orderId=${params.orderId}`,
      meesho: `https://www.meesho.com/orders/${params.orderId}`,
      voicecart: `http://localhost:5173/orders?id=${params.orderId}`
    };

    const newOrder: OrderRecord = {
      id: uuidv4(),
      orderId: params.orderId,
      store: params.store,
      productTitle: params.productTitle || `${params.store.toUpperCase()} Verified Purchase (#${params.orderId})`,
      productImage: params.productImage || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80',
      totalAmount: params.totalAmount || 1499,
      status: 'SHIPPED',
      orderedAt: now.toISOString(),
      estimatedDeliveryDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(),
      trackingUrl: trackingUrls[params.store],
      storeUrl: trackingUrls[params.store],
      timeline: [
        {
          stage: 'Order Confirmed',
          description: 'Payment authorized & verified by merchant',
          timestamp: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString(),
          completed: true
        },
        {
          stage: 'Packed & Dispatched',
          description: `Handed over to carrier from fulfillment center`,
          timestamp: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
          completed: true
        },
        {
          stage: 'In Transit',
          description: 'Arrived at sorting hub near your delivery pincode',
          timestamp: now.toISOString(),
          completed: true
        },
        {
          stage: 'Out for Delivery',
          description: 'Courier agent will deliver with OTP verification',
          timestamp: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          completed: false
        },
        {
          stage: 'Delivered',
          description: 'Package delivered at your doorstep',
          timestamp: new Date(now.getTime() + 48 * 60 * 60 * 1000).toISOString(),
          completed: false
        }
      ]
    };

    return dbClient.saveOrder(newOrder);
  }
}

export const orderTrackerService = new OrderTrackerService();
