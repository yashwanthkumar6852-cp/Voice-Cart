import crypto from 'crypto';
import { IStoreProvider } from './storeProvider.interface';
import { amazonProvider } from './amazonProvider';
import { flipkartProvider } from './flipkartProvider';
import { meeshoProvider } from './meeshoProvider';
import { Product, SearchFilters, StoreName, StoreStatus } from '../types/product';
import { cacheService } from '../cache/redisClient';

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  const n = parseFloat(String(value ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function productKey(p: Product): string {
  const base = p.productId
    ? String(p.productId)
    : crypto
        .createHash("md5")
        .update(`${p.productUrl ?? ""}|${p.title ?? ""}`)
        .digest("hex")
        .slice(0, 12);
  return `${p.store}-${base}`;
}

// number of useful fields, used as a tie-breaker
function completeness(p: Product): number {
  return [p.imageUrl, p.rating, p.ratingCount, p.deliveryDays, p.seller, p.productUrl]
    .filter(Boolean).length;
}

export function dedupeProducts(products: Product[]): Product[] {
  const map = new Map<string, Product>();

  for (const p of products) {
    const key = productKey(p);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, p);
      continue;
    }

    const newPrice = toNumber(p.price);
    const oldPrice = toNumber(existing.price);

    const newIsCheaper = newPrice > 0 && (oldPrice === 0 || newPrice < oldPrice);
    const samePriceMoreData =
      newPrice === oldPrice && completeness(p) > completeness(existing);

    if (newIsCheaper || samePriceMoreData) map.set(key, p);
  }

  return Array.from(map.values());
}

export class AggregatorService {
  private providers: Map<StoreName, IStoreProvider> = new Map();

  constructor() {
    this.providers.set('amazon', amazonProvider);
    this.providers.set('flipkart', flipkartProvider);
    this.providers.set('meesho', meeshoProvider);
  }

  public async getStoreStatuses(): Promise<StoreStatus[]> {
    const statuses: StoreStatus[] = [];
    for (const [store, provider] of this.providers.entries()) {
      const health = await provider.checkHealth();
      statuses.push({
        store,
        name: provider.displayName,
        isAvailable: health.isAvailable,
        itemCount: 0,
        message: health.message
      });
    }
    return statuses;
  }

  public async searchAllStores(query: string, filters: SearchFilters = {}): Promise<{
    products: Product[];
    storeStatuses: StoreStatus[];
  }> {
    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `search:${normalizedQuery}:${JSON.stringify(filters)}`;

    // Check Redis / In-memory Cache
    const cached = await cacheService.get<{ products: Product[]; storeStatuses: StoreStatus[] }>(cacheKey);
    if (cached) {
      console.log(`⚡ Cache hit for query: "${query}"`);
      return cached;
    }

    const storesToQuery: StoreName[] = filters.stores && filters.stores.length > 0 
      ? filters.stores 
      : ['amazon', 'flipkart', 'meesho'];

    const searchPromises = storesToQuery.map(async (storeName) => {
      const provider = this.providers.get(storeName);
      if (!provider) {
        return {
          store: storeName,
          name: storeName,
          products: [],
          status: {
            store: storeName,
            name: storeName,
            isAvailable: false,
            itemCount: 0,
            message: 'Provider not registered'
          }
        };
      }

      const startTime = Date.now();
      const isConfigured = provider.isConfigured();

      if (!isConfigured) {
        const health = await provider.checkHealth();
        return {
          store: storeName,
          name: provider.displayName,
          products: [],
          status: {
            store: storeName,
            name: provider.displayName,
            isAvailable: false,
            itemCount: 0,
            message: health.message || 'Credentials not configured in .env',
            responseTimeMs: 0
          }
        };
      }

      try {
        const results = await provider.search(query, filters);
        const duration = Date.now() - startTime;
        return {
          store: storeName,
          name: provider.displayName,
          products: results,
          status: {
            store: storeName,
            name: provider.displayName,
            isAvailable: true,
            itemCount: results.length,
            message: results.length > 0 ? `Found ${results.length} live items` : 'No live items matched filters',
            responseTimeMs: duration
          }
        };
      } catch (err: any) {
        const duration = Date.now() - startTime;
        console.error(`Store query failed for ${storeName}:`, err.message);
        return {
          store: storeName,
          name: provider.displayName,
          products: [],
          status: {
            store: storeName,
            name: provider.displayName,
            isAvailable: false,
            itemCount: 0,
            message: `API Error: ${err.message}`,
            responseTimeMs: duration
          }
        };
      }
    });

    const outcomes = await Promise.allSettled(searchPromises);
    const aggregatedProducts: Product[] = [];
    const storeStatuses: StoreStatus[] = [];

    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled') {
        aggregatedProducts.push(...outcome.value.products);
        storeStatuses.push(outcome.value.status);
      }
    }

    const dedupedProducts = this.dedupeProducts(aggregatedProducts);
    const result = { products: dedupedProducts, storeStatuses };
    
    // Cache if we have results
    if (dedupedProducts.length > 0) {
      await cacheService.set(cacheKey, result, 300); // 5 min TTL
    }

    return result;
  }

  public dedupeProducts(products: Product[]): Product[] {
    return dedupeProducts(products);
  }

  public async getProductLive(store: StoreName, productId: string): Promise<Product | null> {
    const provider = this.providers.get(store);
    if (!provider) return null;
    return provider.getProduct(productId);
  }
}

export const aggregatorService = new AggregatorService();
