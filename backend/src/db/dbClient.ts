import { Pool } from 'pg';
import { config } from '../config';
import { CartItem, OrderRecord } from '../types/product';

class DatabaseClient {
  private pool: Pool | null = null;
  private isConnected = false;
  private inMemoryCart: Map<string, CartItem> = new Map();
  private inMemoryOrders: Map<string, OrderRecord> = new Map();

  constructor() {
    if (config.databaseUrl) {
      this.initPostgres();
    } else {
      console.log('📦 Using in-memory transactional store for Cart and Orders.');
    }
  }

  private async initPostgres() {
    try {
      this.pool = new Pool({
        connectionString: config.databaseUrl,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
      });

      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS cart_items (
          id VARCHAR(64) PRIMARY KEY,
          product_id VARCHAR(64) NOT NULL,
          store VARCHAR(32) NOT NULL,
          payload JSONB NOT NULL,
          quantity INT DEFAULT 1,
          added_price NUMERIC NOT NULL,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS orders (
          id VARCHAR(64) PRIMARY KEY,
          order_id VARCHAR(128) NOT NULL,
          store VARCHAR(32) NOT NULL,
          product_title TEXT NOT NULL,
          total_amount NUMERIC NOT NULL,
          status VARCHAR(32) NOT NULL,
          payload JSONB NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);
      this.isConnected = true;
      console.log('✅ PostgreSQL schema initialized successfully.');
    } catch (e: any) {
      console.warn('⚠️ PostgreSQL connection failed, operating with in-memory persistence:', e.message);
      this.isConnected = false;
    }
  }

  // --- Cart Operations ---
  public async getCart(): Promise<CartItem[]> {
    if (this.isConnected && this.pool) {
      const res = await this.pool.query('SELECT * FROM cart_items ORDER BY updated_at DESC');
      return res.rows.map((r: any) => ({
        id: r.id,
        product: r.payload.product,
        quantity: r.quantity,
        addedPrice: parseFloat(r.added_price),
        currentPrice: r.payload.currentPrice || parseFloat(r.added_price),
        priceChanged: Boolean(r.payload.priceChanged),
        priceDelta: r.payload.priceDelta || 0,
        addedAt: r.updated_at.toISOString()
      }));
    }
    return Array.from(this.inMemoryCart.values());
  }

  public async saveCartItem(item: CartItem): Promise<CartItem> {
    if (this.isConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO cart_items (id, product_id, store, payload, quantity, added_price, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, NOW())
         ON CONFLICT (id) DO UPDATE SET
         payload = $4, quantity = $5, updated_at = NOW()`,
        [item.id, item.product.productId, item.product.store, JSON.stringify(item), item.quantity, item.addedPrice]
      );
    }
    this.inMemoryCart.set(item.id, item);
    return item;
  }

  public async removeCartItem(id: string): Promise<boolean> {
    if (this.isConnected && this.pool) {
      await this.pool.query('DELETE FROM cart_items WHERE id = $1', [id]);
    }
    return this.inMemoryCart.delete(id);
  }

  public async clearCart(): Promise<void> {
    if (this.isConnected && this.pool) {
      await this.pool.query('DELETE FROM cart_items');
    }
    this.inMemoryCart.clear();
  }

  // --- Order Operations ---
  public async getOrders(): Promise<OrderRecord[]> {
    if (this.isConnected && this.pool) {
      const res = await this.pool.query('SELECT payload FROM orders ORDER BY created_at DESC');
      return res.rows.map((r: any) => r.payload);
    }
    return Array.from(this.inMemoryOrders.values());
  }

  public async saveOrder(order: OrderRecord): Promise<OrderRecord> {
    if (this.isConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO orders (id, order_id, store, product_title, total_amount, status, payload)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET status = $6, payload = $7`,
        [order.id, order.orderId, order.store, order.productTitle, order.totalAmount, order.status, JSON.stringify(order)]
      );
    }
    this.inMemoryOrders.set(order.id, order);
    return order;
  }

  public async getOrderById(orderIdOrId: string): Promise<OrderRecord | null> {
    if (this.isConnected && this.pool) {
      const res = await this.pool.query('SELECT payload FROM orders WHERE id = $1 OR order_id = $1 LIMIT 1', [orderIdOrId]);
      if (res.rows.length > 0) return res.rows[0].payload;
    }
    for (const order of this.inMemoryOrders.values()) {
      if (order.id === orderIdOrId || order.orderId.toLowerCase() === orderIdOrId.toLowerCase()) {
        return order;
      }
    }
    return null;
  }
}

export const dbClient = new DatabaseClient();
