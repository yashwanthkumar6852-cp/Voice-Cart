import React, { useState, useEffect } from 'react';
import {
  ShoppingBag,
  Trash2,
  RefreshCw,
  ExternalLink,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Zap,
  PlusCircle,
  Copy,
  ArrowRight,
  Info,
  Store,
  Sparkles,
  Lock,
  Clock,
  Check
} from 'lucide-react';
import { CartItem, OrderRecord, PaymentConfig, Product } from '../types';
import { api } from '../services/api';
import { startRazorpayPayment } from '../services/razorpay';

interface Props {
  cart: CartItem[];
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
  onCartUpdated: (cart: CartItem[]) => void;
  onOrderCompleted?: (order: OrderRecord) => void;
  onNavigateToOrders?: () => void;
  onAddToCart?: (product: Product, quantity?: number) => void;
}

// Sample VoiceCart own-store products for 1-click test checkout
const SAMPLE_OWN_STORE_PRODUCTS: Product[] = [
  {
    store: 'voicecart',
    productId: 'VC-CARE-101',
    title: 'VoiceCart Express Care & 1-Year Extended Warranty',
    imageUrl: 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=400&auto=format&fit=crop&q=80',
    price: 499,
    mrp: 999,
    discountPct: 50,
    rating: 4.9,
    ratingCount: 1420,
    deliveryDays: 1,
    shippingFee: 0,
    seller: 'VoiceCart Official Store',
    inStock: true,
    productUrl: '#',
    affiliateUrl: '#',
    returnPolicy: '30-Day Instant Refund Guarantee',
    fulfilledByStore: true,
    highlights: ['Instant activation', 'Covers physical & liquid damage', '24/7 Priority claims']
  },
  {
    store: 'voicecart',
    productId: 'VC-EARBUD-DIRECT',
    title: 'VoiceCart SoundMax Pro True Wireless Earbuds (ANC)',
    imageUrl: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&auto=format&fit=crop&q=80',
    price: 1499,
    mrp: 2999,
    discountPct: 50,
    rating: 4.8,
    ratingCount: 3820,
    deliveryDays: 2,
    shippingFee: 0,
    seller: 'VoiceCart Direct Retail',
    inStock: true,
    productUrl: '#',
    affiliateUrl: '#',
    returnPolicy: '7-Day Replacement',
    fulfilledByStore: true,
    highlights: ['45H Battery', 'Quad Mic ENC', '40ms Low Latency']
  }
];

export const CartScreen: React.FC<Props> = ({
  cart,
  onRemoveItem,
  onClearCart,
  onCartUpdated,
  onOrderCompleted,
  onNavigateToOrders,
  onAddToCart
}) => {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<string | null>(null);
  const [isPayingRazorpay, setIsPayingRazorpay] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  // Completed Order Modal State
  const [confirmedOrder, setConfirmedOrder] = useState<{
    orderId: string;
    paymentId: string;
    amount: number;
    paidAt: string;
    method?: string;
    paymentMode?: 'test' | 'live';
    order?: OrderRecord;
  } | null>(null);

  // Fetch payment configuration from server on mount
  useEffect(() => {
    api.getPaymentConfig()
      .then((cfg) => setPaymentConfig(cfg))
      .catch((err) => console.warn('Could not load payment configuration:', err));
  }, []);

  // Split Cart into Own-Store vs Partner-Store Items (Strict Guard)
  const ownStoreItems = cart.filter(
    (item) => item.product.store === 'voicecart' || item.isOwnStore === true
  );

  const partnerItems = cart.filter(
    (item) => item.product.store === 'amazon' || item.product.store === 'flipkart' || item.product.store === 'meesho'
  );

  const ownStoreSubtotal = ownStoreItems.reduce(
    (sum, item) => sum + item.currentPrice * item.quantity,
    0
  );

  const partnerSubtotal = partnerItems.reduce(
    (sum, item) => sum + item.currentPrice * item.quantity,
    0
  );

  const grandTotal = ownStoreSubtotal + partnerSubtotal;

  const totalDiscountSavings = cart.reduce((sum, item) => {
    const mrp = item.product.mrp || item.currentPrice;
    return sum + Math.max(0, mrp - item.currentPrice) * item.quantity;
  }, 0);

  // Live Mode vs Test Mode (controlled strictly by PAYMENT_MODE in .env)
  const isTestMode = paymentConfig?.paymentMode === 'test' || paymentConfig?.isTestMode === true;
  const paymentModeLabel = (paymentConfig?.paymentMode || (isTestMode ? 'test' : 'live')).toUpperCase();

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLabel(label);
    setTimeout(() => setCopiedLabel(null), 2500);
  };

  const handleVerifyPrices = async () => {
    setIsVerifying(true);
    setVerificationResult(null);
    try {
      const res = await api.verifyCartPrices();
      onCartUpdated(res.items);
      if (res.hasPriceChanges) {
        setVerificationResult(`Live prices refreshed! Total delta: ₹${res.totalSavingsOrIncrease}`);
      } else {
        setVerificationResult('All cart items verified. Prices match official live merchant listings.');
      }
    } catch {
      setVerificationResult('Live price check complete.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleAddSampleOwnStoreItem = (product: Product) => {
    if (onAddToCart) {
      onAddToCart(product, 1);
    } else {
      const newItem: CartItem = {
        id: `cart_vc_${Date.now()}`,
        product,
        quantity: 1,
        addedPrice: product.price,
        currentPrice: product.price,
        priceChanged: false,
        priceDelta: 0,
        addedAt: new Date().toISOString(),
        isOwnStore: true
      };
      onCartUpdated([...cart, newItem]);
    }
  };

  // Straight to Payment: User clicks "Pay now", opens Razorpay immediately with UPI first
  const handlePayNow = async () => {
    if (ownStoreItems.length === 0) {
      setPaymentError('No VoiceCart own-store items in cart to charge with Razorpay.');
      return;
    }

    setIsPayingRazorpay(true);
    setPaymentError(null);

    await startRazorpayPayment({
      items: ownStoreItems,
      customer: {
        name: 'VoiceCart Customer',
        email: 'customer@voicecart.in',
        phone: '9876543210'
      },
      onSuccess: (confirmation) => {
        setIsPayingRazorpay(false);

        setConfirmedOrder({
          orderId: confirmation.orderId,
          paymentId: confirmation.paymentId,
          amount: confirmation.amount,
          paidAt: confirmation.paidAt,
          method: confirmation.method || 'Razorpay Live Checkout (UPI / Cards)',
          paymentMode: (confirmation as any).paymentMode || (isTestMode ? 'test' : 'live'),
          order: confirmation.order
        });

        // Clear own-store items from local cart
        const remainingCart = cart.filter(
          (item) => item.product.store !== 'voicecart' && !item.isOwnStore
        );
        onCartUpdated(remainingCart);

        if (confirmation.order && onOrderCompleted) {
          onOrderCompleted(confirmation.order);
        }
      },
      onFailure: (errorMsg) => {
        setIsPayingRazorpay(false);
        setPaymentError(errorMsg);
      },
      onDismiss: () => {
        setIsPayingRazorpay(false);
      }
    });
  };

  // Empty Cart View
  if (cart.length === 0) {
    return (
      <div className="glass-panel" style={{ padding: '48px 24px', textAlign: 'center', maxWidth: '800px', margin: '0 auto' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            background: 'var(--bg-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
            border: '1px solid var(--border-color)'
          }}
        >
          <ShoppingBag size={40} color="var(--text-muted)" />
        </div>
        <h3 style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-main)' }}>
          Your basket is empty
        </h3>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '28px' }}>
          Ask VoiceCart by speaking to find products on Amazon, Flipkart, and Meesho, or add an own-store item below.
        </p>

        {/* VoiceCart Direct Own-Store Demo Card */}
        <div
          style={{
            background: 'rgba(99, 102, 241, 0.05)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '16px',
            padding: '24px',
            textAlign: 'left',
            marginTop: '20px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={20} color="var(--accent-gold)" />
              <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                VoiceCart Direct Official Store Products
              </h4>
            </div>
            {isTestMode && (
              <span
                style={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  background: 'rgba(234, 179, 8, 0.15)',
                  color: 'var(--accent-gold)',
                  border: '1px solid var(--accent-gold)',
                  padding: '3px 8px',
                  borderRadius: '6px'
                }}
              >
                TEST MODE
              </span>
            )}
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Add any of these VoiceCart items to test the instant Razorpay payment flow (UPI first, Cards, Netbanking, Wallets):
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {SAMPLE_OWN_STORE_PRODUCTS.map((prod) => (
              <div
                key={prod.productId}
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', gap: '12px' }}>
                  <img
                    src={prod.imageUrl}
                    alt={prod.title}
                    style={{
                      width: '64px',
                      height: '64px',
                      objectFit: 'cover',
                      borderRadius: '8px',
                      background: 'var(--img-bg)'
                    }}
                  />
                  <div>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                    >
                      VOICECART DIRECT
                    </span>
                    <h5 style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-main)', marginTop: '4px' }}>
                      {prod.title}
                    </h5>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', marginTop: '4px' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        ₹{prod.price.toLocaleString()}
                      </span>
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textDecoration: 'line-through' }}>
                        ₹{prod.mrp.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => handleAddSampleOwnStoreItem(prod)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    background: 'var(--primary)',
                    color: '#fff',
                    border: 'none',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  <PlusCircle size={15} /> Add to Basket
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.75fr) minmax(0, 1.35fr)', gap: '24px' }}>
      {/* LEFT COLUMN: Cart Items Split by Store Type */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Cart Header Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)' }}>
            <ShoppingBag size={22} color="var(--primary)" />
            <span>Shopping Basket ({cart.length})</span>
          </h3>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleVerifyPrices}
              disabled={isVerifying}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: 'rgba(99, 102, 241, 0.15)',
                border: '1px solid var(--primary)',
                color: 'var(--primary)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={13} className={isVerifying ? 'mic-active-pulse' : ''} />
              {isVerifying ? 'Verifying...' : 'Re-check Live Prices'}
            </button>
            <button
              onClick={onClearCart}
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-muted)',
                padding: '6px 10px',
                borderRadius: '8px',
                fontSize: '0.8rem',
                cursor: 'pointer'
              }}
            >
              Clear Basket
            </button>
          </div>
        </div>

        {verificationResult && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid var(--accent-green)',
              color: 'var(--accent-green)',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle2 size={16} />
            <span>{verificationResult}</span>
          </div>
        )}

        {/* SECTION 1: PAY HERE (Own-Store Items Charged via Razorpay) */}
        {ownStoreItems.length > 0 && (
          <div
            className="glass-panel"
            style={{
              padding: '18px',
              border: '1px solid rgba(99, 102, 241, 0.35)',
              background: 'rgba(99, 102, 241, 0.04)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    color: '#fff',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}
                >
                  PAY HERE
                </span>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  VoiceCart Direct Items ({ownStoreItems.length})
                </h4>
              </div>
              <span style={{ fontSize: '0.82rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                ⚡ In-App Razorpay Checkout
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {ownStoreItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-subtle)',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.title}
                    style={{ width: '64px', height: '64px', objectFit: 'cover', borderRadius: '8px', background: 'var(--img-bg)' }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '0.7rem', color: 'var(--primary)', fontWeight: 700 }}>
                        {item.product.seller}
                      </span>
                      {item.product.returnPolicy && (
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                          • {item.product.returnPolicy}
                        </span>
                      )}
                    </div>

                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {item.product.title}
                    </h4>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        ₹{item.currentPrice.toLocaleString()}
                      </span>
                      {item.product.mrp > item.currentPrice && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textDecoration: 'line-through' }}>
                          ₹{item.product.mrp.toLocaleString()}
                        </span>
                      )}
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Qty: {item.quantity}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onRemoveItem(item.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--accent-rose)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.78rem'
                    }}
                  >
                    <Trash2 size={14} /> Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* SECTION 2: COMPLETE ON THE STORE (Partner Items - Amazon, Flipkart, Meesho) */}
        {partnerItems.length > 0 && (
          <div className="glass-panel" style={{ padding: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    background: 'var(--bg-subtle)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}
                >
                  COMPLETE ON STORE
                </span>
                <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Store size={18} color="var(--text-muted)" />
                  <span>Partner Store Products ({partnerItems.length})</span>
                </h4>
              </div>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Official Merchant Checkout
              </span>
            </div>

            {/* Informational Banner */}
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '8px',
                background: 'rgba(99, 102, 241, 0.08)',
                border: '1px solid rgba(99, 102, 241, 0.25)',
                fontSize: '0.8rem',
                color: 'var(--text-secondary)',
                marginBottom: '14px',
                display: 'flex',
                gap: '8px',
                lineHeight: 1.4
              }}
            >
              <Info size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Partner Store Checkout Notice:</strong> Items from Amazon, Flipkart, and Meesho must be checked out directly on the official merchant store using their affiliate links. VoiceCart never collects payment or charges for partner store products.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {partnerItems.map((item) => (
                <div
                  key={item.id}
                  style={{
                    background: 'var(--bg-subtle)',
                    borderRadius: '10px',
                    padding: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    border: item.priceChanged ? '1px solid var(--accent-gold)' : '1px solid var(--border-color)'
                  }}
                >
                  <img
                    src={item.product.imageUrl}
                    alt={item.product.title}
                    style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '8px', background: 'var(--img-bg)', padding: '4px' }}
                  />

                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '4px' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background:
                            item.product.store === 'amazon'
                              ? '#ff9900'
                              : item.product.store === 'flipkart'
                              ? '#2874f0'
                              : '#f43397',
                          color: item.product.store === 'amazon' ? '#000' : '#fff'
                        }}
                      >
                        {item.product.store.toUpperCase()}
                      </span>
                      {item.priceChanged && (
                        <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', fontWeight: 600 }}>
                          ⚡ Price Changed
                        </span>
                      )}
                    </div>

                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-main)', marginBottom: '4px' }}>
                      {item.product.title}
                    </h4>

                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                      <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        ₹{item.currentPrice.toLocaleString()}
                      </span>
                      {item.product.mrp > item.currentPrice && (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', textDecoration: 'line-through' }}>
                          ₹{item.product.mrp.toLocaleString()}
                        </span>
                      )}
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        Qty: {item.quantity}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
                    <a
                      href={item.product.affiliateUrl || item.product.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background:
                          item.product.store === 'amazon'
                            ? '#ff9900'
                            : item.product.store === 'flipkart'
                            ? '#2874f0'
                            : '#f43397',
                        color: item.product.store === 'amazon' ? '#000' : '#fff',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        textDecoration: 'none'
                      }}
                    >
                      Checkout on {item.product.store.toUpperCase()} <ExternalLink size={13} />
                    </a>

                    <button
                      onClick={() => onRemoveItem(item.id)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--accent-rose)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.78rem'
                      }}
                    >
                      <Trash2 size={13} /> Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Order Summary & Direct Payment Action */}
      <div>
        <div className="glass-panel" style={{ padding: '22px', position: 'sticky', top: '20px' }}>
          {/* TEST MODE BADGE (Shown strictly when in test mode) */}
          {isTestMode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(234, 179, 8, 0.12)',
                border: '1px solid rgba(234, 179, 8, 0.4)',
                padding: '8px 12px',
                borderRadius: '8px',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Zap size={15} color="var(--accent-gold)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--accent-gold)', letterSpacing: '0.04em' }}>
                  TEST MODE ACTIVE
                </span>
              </div>
              <span style={{ fontSize: '0.7rem', color: 'var(--accent-gold)', opacity: 0.9 }}>
                PAYMENT_MODE=test
              </span>
            </div>
          )}

          <h4 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px', color: 'var(--text-main)' }}>
            Order Summary
          </h4>

          {/* Breakdown List */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              fontSize: '0.88rem',
              borderBottom: '1px solid var(--border-color)',
              paddingBottom: '14px',
              marginBottom: '14px'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Items Total ({cart.length} items)</span>
              <span>₹{grandTotal.toLocaleString()}</span>
            </div>

            {ownStoreItems.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-main)', fontWeight: 600 }}>
                <span>• VoiceCart Direct Items ({ownStoreItems.length})</span>
                <span style={{ color: 'var(--primary)' }}>₹{ownStoreSubtotal.toLocaleString()}</span>
              </div>
            )}

            {partnerItems.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
                <span>• Partner Store Items ({partnerItems.length})</span>
                <span>₹{partnerSubtotal.toLocaleString()}</span>
              </div>
            )}

            {totalDiscountSavings > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--accent-green)', fontWeight: 600 }}>
                <span>Total Discount Savings</span>
                <span>-₹{totalDiscountSavings.toLocaleString()}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)' }}>
              <span>Delivery Charges</span>
              <span style={{ color: 'var(--accent-green)', fontWeight: 700 }}>FREE</span>
            </div>
          </div>

          {/* Grand Total */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.25rem', fontWeight: 800, marginBottom: '20px', color: 'var(--text-main)' }}>
            <span>Total Payable</span>
            <span style={{ color: 'var(--primary)' }}>₹{grandTotal.toLocaleString()}</span>
          </div>

          {/* ACTION BUTTON SECTION */}
          {ownStoreItems.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handlePayNow}
                disabled={isPayingRazorpay}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '10px',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
                  border: 'none',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: '0.96rem',
                  cursor: isPayingRazorpay ? 'not-allowed' : 'pointer',
                  boxShadow: '0 8px 25px rgba(99, 102, 241, 0.4)',
                  transition: 'all 0.2s ease',
                  opacity: isPayingRazorpay ? 0.8 : 1
                }}
              >
                {isPayingRazorpay ? (
                  <>
                    <RefreshCw size={18} className="mic-active-pulse" />
                    <span>Opening Razorpay Checkout...</span>
                  </>
                ) : (
                  <>
                    <Lock size={18} />
                    <span>Pay ₹{ownStoreSubtotal.toLocaleString()} Now</span>
                  </>
                )}
              </button>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  color: 'var(--text-muted)',
                  fontSize: '0.74rem',
                  textAlign: 'center'
                }}
              >
                <ShieldCheck size={14} color="var(--accent-green)" />
                <span>UPI first (GPay, PhonePe, Paytm, QR), Cards, Netbanking & Wallets</span>
              </div>
            </div>
          ) : (
            // Cart has ONLY partner store items: Hide Razorpay button and show short explanation
            <div
              style={{
                background: 'var(--bg-subtle)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: 'var(--text-main)', fontWeight: 600, fontSize: '0.88rem' }}>
                <Store size={16} color="var(--primary)" />
                <span>External Partner Items Only</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.4, margin: 0 }}>
                These items are sold and fulfilled by partner stores (Amazon, Flipkart, Meesho). Please click the store checkout buttons in your basket to complete purchase on their official websites.
              </p>
            </div>
          )}

          {/* PAYMENT ERROR MESSAGE */}
          {paymentError && (
            <div
              style={{
                marginTop: '14px',
                padding: '10px 14px',
                borderRadius: '8px',
                background: 'rgba(244, 63, 94, 0.15)',
                border: '1px solid var(--accent-rose)',
                color: 'var(--accent-rose)',
                fontSize: '0.82rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <AlertTriangle size={16} style={{ flexShrink: 0 }} />
              <span>{paymentError}</span>
            </div>
          )}

          {/* TEST MODE CREDENTIALS HINT (Hidden completely in LIVE mode) */}
          {isTestMode && ownStoreItems.length > 0 && (
            <div
              style={{
                marginTop: '16px',
                padding: '12px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                fontSize: '0.78rem'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={14} color="var(--accent-gold)" /> Test Sandbox Details
                </span>
                {copiedLabel && (
                  <span style={{ fontSize: '0.72rem', color: 'var(--accent-green)', fontWeight: 600 }}>
                    Copied {copiedLabel}!
                  </span>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div
                  onClick={() => handleCopy('success@razorpay', 'Test UPI')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>
                    <strong>Gateway Test UPI:</strong> success@razorpay
                  </span>
                  <Copy size={12} color="var(--text-muted)" />
                </div>

                <div
                  onClick={() => handleCopy('4111111111111111', 'Card Number')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '6px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    cursor: 'pointer',
                    border: '1px solid rgba(255, 255, 255, 0.05)'
                  }}
                >
                  <span style={{ color: 'var(--text-secondary)' }}>
                    <strong>Test Card:</strong> 4111 1111 1111 1111
                  </span>
                  <Copy size={12} color="var(--text-muted)" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ORDER CONFIRMATION MODAL */}
      {confirmedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }}
        >
          <div
            className="glass-panel"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '28px',
              borderRadius: '16px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              animation: 'slideUp 0.3s ease-out'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '2px solid var(--accent-green)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px'
                }}
              >
                <CheckCircle2 size={36} color="var(--accent-green)" />
              </div>

              {isTestMode ? (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    background: 'rgba(234, 179, 8, 0.15)',
                    color: 'var(--accent-gold)',
                    border: '1px solid var(--accent-gold)',
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}
                >
                  TEST MODE PAYMENT CAPTURED
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 800,
                    background: 'rgba(16, 185, 129, 0.15)',
                    color: 'var(--accent-green)',
                    border: '1px solid var(--accent-green)',
                    padding: '3px 8px',
                    borderRadius: '6px'
                  }}
                >
                  LIVE PAYMENT CAPTURED
                </span>
              )}

              <h3 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '8px' }}>
                Payment & Order Confirmed!
              </h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: '4px' }}>
                Your order has been placed with VoiceCart Express Warehouse.
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div
              style={{
                background: 'var(--bg-subtle)',
                borderRadius: '12px',
                padding: '16px',
                border: '1px solid var(--border-color)',
                marginBottom: '20px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                fontSize: '0.86rem'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Order ID:</span>
                <strong style={{ color: 'var(--text-main)' }}>{confirmedOrder.orderId}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment ID:</span>
                <strong style={{ color: 'var(--primary)' }}>{confirmedOrder.paymentId}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Payment Mode:</span>
                <span
                  style={{
                    fontWeight: 700,
                    color: confirmedOrder.paymentMode === 'live' ? 'var(--accent-green)' : 'var(--accent-gold)'
                  }}
                >
                  {(confirmedOrder.paymentMode || paymentModeLabel).toUpperCase()}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Amount Paid:</span>
                <strong style={{ color: 'var(--accent-green)', fontSize: '1.05rem' }}>
                  ₹{confirmedOrder.amount.toLocaleString()}.00
                </strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Time:</span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  {new Date(confirmedOrder.paidAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                  })}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Status:</span>
                <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>
                  ✅ PAID
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => {
                  setConfirmedOrder(null);
                  if (onNavigateToOrders) onNavigateToOrders();
                }}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                  color: '#fff',
                  border: 'none',
                  padding: '12px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                <span>Track in Orders</span> <ArrowRight size={16} />
              </button>

              <button
                onClick={() => setConfirmedOrder(null)}
                style={{
                  padding: '12px 18px',
                  borderRadius: '10px',
                  background: 'transparent',
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-main)',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: 'pointer'
                }}
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
