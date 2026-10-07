import { Product, RankingPreference, SearchFilters, StoreComparisonSummary, StoreName, StoreStatus } from '../types/product';

interface WeightProfile {
  price: number;
  rating: number;
  quality: number;
  value: number;
  delivery: number;
}

const WEIGHT_PROFILES: Record<RankingPreference, WeightProfile> = {
  balanced: { price: 0.35, rating: 0.25, quality: 0.20, value: 0.10, delivery: 0.10 },
  cheapest: { price: 0.60, rating: 0.15, quality: 0.10, value: 0.10, delivery: 0.05 },
  best_rated: { price: 0.15, rating: 0.45, quality: 0.25, value: 0.05, delivery: 0.10 },
  fastest: { price: 0.25, rating: 0.20, quality: 0.15, value: 0.05, delivery: 0.35 }
};

export class RankingEngine {
  /**
   * Scores, ranks and attaches explainability metadata to products.
   */
  public rank(
    products: Product[],
    filters: SearchFilters = {},
    storeStatuses: StoreStatus[] = []
  ): {
    rankedProducts: Product[];
    topRecommendations: {
      bestOverall?: Product;
      lowestPrice?: Product;
      fastestDelivery?: Product;
      bestRated?: Product;
    };
    comparisonMatrix: StoreComparisonSummary[];
  } {
    if (!products || products.length === 0) {
      return {
        rankedProducts: [],
        topRecommendations: {},
        comparisonMatrix: this.buildComparisonMatrix([], storeStatuses)
      };
    }

    // 1. Filter out out-of-stock and very poor ratings (< 2.5)
    let candidates = products.filter((p) => {
      if (filters.inStockOnly !== false && !p.inStock) return false;
      if (p.rating > 0 && p.rating < 2.5) return false;
      if (filters.maxBudget && p.price > filters.maxBudget) return false;
      if (filters.minBudget && p.price < filters.minBudget) return false;
      if (filters.brand && !p.title.toLowerCase().includes(filters.brand.toLowerCase())) return false;
      return true;
    });

    if (candidates.length === 0) {
      // If filtering was too strict, fallback to all products
      candidates = [...products];
    }

    const preference: RankingPreference = filters.preference || 'balanced';
    const weights = WEIGHT_PROFILES[preference] || WEIGHT_PROFILES.balanced;

    // Determine price range for normalization
    const totalCosts = candidates.map((p) => p.price + (p.shippingFee || 0));
    const minCost = Math.min(...totalCosts);
    const maxCost = Math.max(...totalCosts);

    // 2. Compute 0-100 score for each candidate
    const scoredCandidates = candidates.map((p) => {
      const totalCost = p.price + (p.shippingFee || 0);

      // Price Score (0 - 100): Inverse price ratio relative to cheapest option
      let priceScore = 100;
      if (filters.maxBudget && filters.maxBudget > 0) {
        // When max budget is defined, score relative to budget headroom
        priceScore = Math.max(10, Math.min(100, Math.round(100 * (1 - (totalCost / (filters.maxBudget * 1.2))))));
      } else if (minCost > 0) {
        // Inverse price scale: (minCost / totalCost) * 100
        priceScore = Math.max(15, Math.min(100, Math.round((minCost / totalCost) * 100)));
      }

      // Rating Score with Bayesian smoothing (m=25 prior reviews with mean 4.0)
      const v = Math.min(p.ratingCount || 10, 500);
      const m = 25;
      const C = 4.0;
      const bayesianRating = (v * (p.rating || 4.0) + m * C) / (v + m);
      const ratingScore = (bayesianRating / 5.0) * 100;

      // Quality Signals Score (0 - 100)
      let qualityScore = 30; // base
      if (p.returnPolicy && !p.returnPolicy.toLowerCase().includes('no return')) {
        qualityScore += 30;
      }
      if (p.fulfilledByStore) {
        qualityScore += 25;
      }
      if (p.seller && !p.seller.toLowerCase().includes('generic')) {
        qualityScore += 15;
      }
      qualityScore = Math.min(qualityScore, 100);

      // Value / Unit score (0 - 100)
      const discountBonus = Math.min(p.discountPct || 0, 50) * 1.5;
      const valueScore = Math.min(50 + discountBonus, 100);

      // Delivery Speed Score (0 - 100)
      let deliveryScore = 50;
      if (p.deliveryDays <= 1) deliveryScore = 100;
      else if (p.deliveryDays === 2) deliveryScore = 85;
      else if (p.deliveryDays === 3) deliveryScore = 70;
      else if (p.deliveryDays <= 5) deliveryScore = 50;
      else deliveryScore = 30;

      // Weighted Composite Score
      const totalScore = Math.round(
        priceScore * weights.price +
        ratingScore * weights.rating +
        qualityScore * weights.quality +
        valueScore * weights.value +
        deliveryScore * weights.delivery
      );

      const badges: string[] = [];

      return {
        ...p,
        score: Math.max(0, Math.min(100, totalScore)),
        badges
      };
    });

    // 3. Sort by highest score first
    scoredCandidates.sort((a, b) => (b.score || 0) - (a.score || 0));

    // 4. Identify specific standout products
    const lowestPriceProduct = [...scoredCandidates].sort(
      (a, b) => (a.price + a.shippingFee) - (b.price + b.shippingFee)
    )[0];

    const fastestDeliveryProduct = [...scoredCandidates].sort(
      (a, b) => a.deliveryDays - b.deliveryDays
    )[0];

    const bestRatedProduct = [...scoredCandidates].sort(
      (a, b) => (b.rating * Math.log10(b.ratingCount + 10)) - (a.rating * Math.log10(a.ratingCount + 10))
    )[0];

    const bestOverallProduct = scoredCandidates[0];

    // 5. Attach badges and human-readable explainable reasons
    scoredCandidates.forEach((p, idx) => {
      const badges: string[] = [];
      const isBestOverall = bestOverallProduct && p.productId === bestOverallProduct.productId && p.store === bestOverallProduct.store;
      const isLowestPrice = lowestPriceProduct && p.productId === lowestPriceProduct.productId && p.store === lowestPriceProduct.store;
      const isFastest = fastestDeliveryProduct && p.productId === fastestDeliveryProduct.productId && p.store === fastestDeliveryProduct.store;
      const isTopRated = bestRatedProduct && p.productId === bestRatedProduct.productId && p.store === bestRatedProduct.store;

      if (isBestOverall) badges.push('Best Overall');
      if (isLowestPrice) badges.push('Lowest Price');
      if (isFastest && !isBestOverall) badges.push('Fastest Delivery');
      if (isTopRated && !isBestOverall && !isLowestPrice) badges.push('Top Rated');

      if (idx === 0 && badges.length === 0) badges.push('Recommended');

      p.badges = badges;
      p.reason = this.generateReason(p, {
        isBestOverall,
        isLowestPrice,
        isFastest,
        isTopRated,
        preference
      });
    });

    // 6. Build Comparison Matrix
    const comparisonMatrix = this.buildComparisonMatrix(scoredCandidates, storeStatuses);

    return {
      rankedProducts: scoredCandidates,
      topRecommendations: {
        bestOverall: bestOverallProduct,
        lowestPrice: lowestPriceProduct,
        fastestDelivery: fastestDeliveryProduct,
        bestRated: bestRatedProduct
      },
      comparisonMatrix
    };
  }

  private generateReason(
    product: Product,
    context: {
      isBestOverall: boolean;
      isLowestPrice: boolean;
      isFastest: boolean;
      isTopRated: boolean;
      preference: RankingPreference;
    }
  ): string {
    const storeDisplay = product.store === 'amazon' ? 'Amazon' : product.store === 'flipkart' ? 'Flipkart' : 'Meesho';
    const totalCost = product.price + product.shippingFee;

    if (context.isBestOverall) {
      return `Top pick on ${storeDisplay} combining lowest price (₹${totalCost}), ${product.rating}★ rating (${product.ratingCount}+ reviews) and ${product.deliveryDays}-day delivery.`;
    }

    if (context.isLowestPrice) {
      return `Cheapest deal at ₹${totalCost} with ${product.discountPct > 0 ? `${product.discountPct}% off MRP` : 'best unit pricing'}.`;
    }

    if (context.isFastest) {
      return `Fastest dispatch: arrives in ${product.deliveryDays} ${product.deliveryDays === 1 ? 'day' : 'days'} via ${product.fulfilledByStore ? 'express delivery' : 'standard courier'}.`;
    }

    if (context.isTopRated) {
      return `Highest customer satisfaction with ${product.rating}★ across ${product.ratingCount} verified purchases.`;
    }

    return `Available on ${storeDisplay} for ₹${totalCost} (${product.discountPct}% off, ${product.deliveryDays}d shipping).`;
  }

  private buildComparisonMatrix(products: Product[], storeStatuses: StoreStatus[]): StoreComparisonSummary[] {
    const stores: StoreName[] = ['amazon', 'flipkart', 'meesho'];
    const storeNames: Record<StoreName, string> = {
      amazon: 'Amazon India',
      flipkart: 'Flipkart',
      meesho: 'Meesho',
      voicecart: 'VoiceCart Direct'
    };

    return stores.map((store) => {
      const storeProducts = products.filter((p) => p.store === store);
      const status = storeStatuses.find((s) => s.store === store);

      if (storeProducts.length === 0) {
        return {
          store,
          storeDisplayName: storeNames[store],
          available: status ? status.isAvailable : false,
          notice: status?.message || 'No products available under current criteria'
        };
      }

      const topItem = storeProducts[0];
      const lowestPrice = Math.min(...storeProducts.map((p) => p.price + p.shippingFee));
      const avgRating = Number((storeProducts.reduce((sum, p) => sum + p.rating, 0) / storeProducts.length).toFixed(1));
      const fastestDays = Math.min(...storeProducts.map((p) => p.deliveryDays));

      return {
        store,
        storeDisplayName: storeNames[store],
        topProductTitle: topItem.title,
        lowestPrice,
        avgRating,
        fastestDeliveryDays: fastestDays,
        available: true,
        affiliateUrl: topItem.affiliateUrl
      };
    });
  }
}

export const rankingEngine = new RankingEngine();
