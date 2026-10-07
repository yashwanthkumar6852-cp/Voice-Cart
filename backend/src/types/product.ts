export type StoreName = 'amazon' | 'flipkart' | 'meesho' | 'voicecart';

export type RankingPreference = 'balanced' | 'cheapest' | 'best_rated' | 'fastest';

export interface Product {
  store: StoreName;
  productId: string;
  title: string;
  imageUrl: string;
  price: number;
  mrp: number;
  discountPct: number;
  rating: number;
  ratingCount: number;
  deliveryDays: number;
  shippingFee: number;
  seller: string;
  inStock: boolean;
  quantity?: string;
  productUrl: string;
  affiliateUrl: string;
  returnPolicy?: string;
  fulfilledByStore?: boolean;
  score?: number;
  badges?: string[];
  reason?: string;
  highlights?: string[];
}

export interface StoreStatus {
  store: StoreName;
  name: string;
  isAvailable: boolean;
  itemCount: number;
  message?: string;
  responseTimeMs?: number;
}

export interface SearchFilters {
  maxBudget?: number;
  minBudget?: number;
  brand?: string;
  preference?: RankingPreference;
  stores?: StoreName[];
  inStockOnly?: boolean;
}

export interface SearchResponse {
  query: string;
  filters: SearchFilters;
  totalResults: number;
  products: Product[];
  topRecommendations: {
    bestOverall?: Product;
    lowestPrice?: Product;
    fastestDelivery?: Product;
    bestRated?: Product;
  };
  comparisonMatrix: StoreComparisonSummary[];
  storeStatuses: StoreStatus[];
  timestamp: string;
}

export interface StoreComparisonSummary {
  store: StoreName;
  storeDisplayName: string;
  topProductTitle?: string;
  lowestPrice?: number;
  avgRating?: number;
  fastestDeliveryDays?: number;
  available: boolean;
  affiliateUrl?: string;
  notice?: string;
}

export interface VoiceIntentResult {
  intent: 'SEARCH' | 'COMPARE' | 'ADD_TO_CART' | 'REMOVE_FROM_CART' | 'VIEW_CART' | 'BUY_NOW' | 'TRACK_ORDER' | 'READ_DETAILS' | 'CLARIFY_BUDGET' | 'UNKNOWN';
  language: 'en' | 'hi' | 'kn';
  productQuery?: string;
  maxBudget?: number;
  brand?: string;
  quantity?: number;
  preference?: RankingPreference;
  orderId?: string;
  missingSlot?: 'budget' | 'product';
  clarifyingQuestion?: string;
  spokenResponse: string;
  actionPayload?: any;
}

export interface CartItem {
  id: string;
  product: Product;
  quantity: number;
  addedPrice: number;
  currentPrice: number;
  priceChanged: boolean;
  priceDelta: number;
  addedAt: string;
  isOwnStore?: boolean;
}

export interface OrderRecord {
  id: string;
  orderId: string;
  store: StoreName;
  productTitle: string;
  productImage?: string;
  totalAmount: number;
  status: 'CREATED' | 'PENDING_VERIFICATION' | 'PAID' | 'ORDERED' | 'PACKED' | 'SHIPPED' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED' | 'FAILED';
  orderedAt: string;
  estimatedDeliveryDate?: string;
  trackingUrl: string;
  storeUrl: string;
  paymentId?: string;
  paymentOrderId?: string;
  paymentMethod?: string;
  paymentMode?: 'test' | 'live';
  paidAt?: string;
  utrNumber?: string;
  items?: CartItem[];
  timeline: {
    stage: string;
    description: string;
    timestamp: string;
    completed: boolean;
  }[];
}
