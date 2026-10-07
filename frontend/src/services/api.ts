import axios from 'axios';
import { CartItem, OrderRecord, Product, SearchFilters, SearchResponse, StoreStatus, VoiceIntentResult } from '../types';

const API_BASE = '/api';

export const api = {
  // Search
  search: async (query: string, filters: SearchFilters = {}): Promise<SearchResponse> => {
    const params: any = { q: query };
    if (filters.maxBudget) params.budget = filters.maxBudget;
    if (filters.minBudget) params.minBudget = filters.minBudget;
    if (filters.brand) params.brand = filters.brand;
    if (filters.preference) params.preference = filters.preference;
    if (filters.stores) params.stores = filters.stores.join(',');
    if (filters.inStockOnly !== undefined) params.inStockOnly = filters.inStockOnly;

    const res = await axios.get<SearchResponse>(`${API_BASE}/search`, { params });
    return res.data;
  },

  getStatuses: async (): Promise<StoreStatus[]> => {
    const res = await axios.get<{ storeStatuses: StoreStatus[] }>(`${API_BASE}/search/status`);
    return res.data.storeStatuses;
  },

  // Voice
  transcribeAudioBlob: async (
    formData: FormData
  ): Promise<{ text: string; transcript: string; provider: string; lang: string; durationMs?: number }> => {
    const res = await axios.post(`${API_BASE}/voice/transcribe`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },

  transcribeAudio: async (
    audioBase64: string,
    mimeType = 'audio/webm',
    language = 'en'
  ): Promise<{ transcript: string }> => {
    const res = await axios.post(`${API_BASE}/voice/transcribe`, { audioBase64, mimeType, language });
    return res.data;
  },

  processVoice: async (
    transcript: string,
    context?: any
  ): Promise<{
    intentResult: VoiceIntentResult;
    voiceConfig: any;
    searchData?: SearchResponse;
    cartData?: { cart: CartItem[]; addedItem?: CartItem };
    orderData?: OrderRecord;
  }> => {
    const res = await axios.post(`${API_BASE}/voice/process`, { transcript, context });
    return res.data;
  },

  // Cart
  getCart: async (): Promise<CartItem[]> => {
    const res = await axios.get<{ items: CartItem[] }>(`${API_BASE}/cart`);
    return res.data.items;
  },

  addToCart: async (product: Product, quantity = 1): Promise<{ item: CartItem; cart: CartItem[] }> => {
    const res = await axios.post(`${API_BASE}/cart/add`, { product, quantity });
    return res.data;
  },

  removeFromCart: async (id: string): Promise<{ success: boolean; cart: CartItem[] }> => {
    const res = await axios.delete(`${API_BASE}/cart/${id}`);
    return res.data;
  },

  verifyCartPrices: async (): Promise<{
    items: CartItem[];
    hasPriceChanges: boolean;
    totalSavingsOrIncrease: number;
  }> => {
    const res = await axios.post(`${API_BASE}/cart/verify-prices`);
    return res.data;
  },

  clearCart: async (): Promise<void> => {
    await axios.delete(`${API_BASE}/cart`);
  },

  // Orders
  getOrders: async (): Promise<OrderRecord[]> => {
    const res = await axios.get<{ orders: OrderRecord[] }>(`${API_BASE}/orders`);
    return res.data.orders;
  },

  addOrder: async (orderData: Partial<OrderRecord>): Promise<{ success: boolean; order: OrderRecord }> => {
    const res = await axios.post(`${API_BASE}/orders/add`, orderData);
    return res.data;
  },

  parseOrderSMS: async (text: string): Promise<{ success: boolean; parsed: any; order: OrderRecord }> => {
    const res = await axios.post(`${API_BASE}/orders/parse-message`, { text });
    return res.data;
  },

  // Payment
  getPaymentConfig: async (): Promise<{
    isConfigured: boolean;
    keyId: string;
    paymentMode: 'test' | 'live';
    isTestMode: boolean;
    upiId?: string;
    upiPayeeName?: string;
  }> => {
    const res = await axios.get(`${API_BASE}/payments/config`);
    return res.data;
  },

  createPaymentOrder: async (payload: {
    items?: CartItem[];
    amount?: number;
    notes?: Record<string, string>;
    receiptId?: string;
  }): Promise<{
    success: boolean;
    order: any;
    keyId: string;
    calculatedAmount: number;
    internalOrderId: string;
    paymentMode: 'test' | 'live';
    isTestMode: boolean;
    upiId?: string;
    upiPayeeName?: string;
  }> => {
    const res = await axios.post(`${API_BASE}/payments/create-order`, payload);
    return res.data;
  },

  verifyPayment: async (payload: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
    method?: string;
  }): Promise<{
    success: boolean;
    message: string;
    order?: OrderRecord;
    paymentId: string;
    orderId: string;
    paidAt: string;
    paymentMode?: 'test' | 'live';
  }> => {
    const res = await axios.post(`${API_BASE}/payments/verify`, payload);
    return res.data;
  },

  pollOrderStatus: async (orderId: string): Promise<{
    success: boolean;
    orderId: string;
    status: string;
    isPaid: boolean;
    paymentId?: string;
    paymentMethod?: string;
    totalAmount: number;
    paidAt?: string;
    order?: OrderRecord;
  }> => {
    const res = await axios.get(`${API_BASE}/payments/status/${orderId}`);
    return res.data;
  },

  submitUtr: async (payload: {
    orderId: string;
    utr: string;
    paymentMethod?: string;
  }): Promise<{
    success: boolean;
    message: string;
    order: OrderRecord;
  }> => {
    const res = await axios.post(`${API_BASE}/payments/submit-utr`, payload);
    return res.data;
  },

  adminVerifyUtr: async (payload: {
    orderId: string;
    action: 'APPROVE' | 'REJECT';
    notes?: string;
  }): Promise<{
    success: boolean;
    message: string;
    order: OrderRecord;
  }> => {
    const res = await axios.post(`${API_BASE}/payments/admin/verify-utr`, payload);
    return res.data;
  },

  getAdminOrders: async (): Promise<{
    success: boolean;
    orders: OrderRecord[];
  }> => {
    const res = await axios.get(`${API_BASE}/payments/admin/orders`);
    return res.data;
  },

  requestRefund: async (payload: {
    orderId?: string;
    paymentId?: string;
    amount?: number;
    reason?: string;
  }): Promise<{
    success: boolean;
    message: string;
    refund: any;
    order?: OrderRecord;
  }> => {
    const res = await axios.post(`${API_BASE}/payments/refund`, payload);
    return res.data;
  },

  createRazorpayOrder: async (amount: number, receiptId?: string): Promise<any> => {
    const res = await axios.post(`${API_BASE}/payments/create-order`, { amount, receiptId });
    return res.data;
  }
};
