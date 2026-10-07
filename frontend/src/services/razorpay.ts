import { api } from './api';
import { CartItem, OrderRecord } from '../types';

let scriptLoadingPromise: Promise<boolean> | null = null;

export const loadRazorpayScript = (): Promise<boolean> => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if ((window as any).Razorpay) return Promise.resolve(true);

  if (!scriptLoadingPromise) {
    scriptLoadingPromise = new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        resolve(true);
      };
      script.onerror = () => {
        console.error('Failed to load Razorpay checkout.js script');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  }

  return scriptLoadingPromise;
};

export interface CheckoutOptions {
  items: CartItem[];
  customer?: {
    name?: string;
    email?: string;
    phone?: string;
  };
  onOrderCreated?: (orderId: string, amount: number) => void;
  onSuccess: (confirmation: {
    orderId: string;
    paymentId: string;
    amount: number;
    paidAt: string;
    method?: string;
    paymentMode?: 'test' | 'live';
    order?: OrderRecord;
  }) => void;
  onFailure: (error: string) => void;
  onDismiss?: () => void;
}

export const startRazorpayPayment = async (options: CheckoutOptions): Promise<void> => {
  const isLoaded = await loadRazorpayScript();
  if (!isLoaded || !(window as any).Razorpay) {
    options.onFailure('Unable to load Razorpay payment gateway. Please check your internet connection.');
    return;
  }

  try {
    // 1. Calculate amount on server & create Razorpay order (never trust frontend amounts)
    const orderData = await api.createPaymentOrder({
      items: options.items,
      notes: {
        customerName: options.customer?.name || 'VoiceCart Customer',
        itemCount: String(options.items.length)
      }
    });

    if (!orderData || !orderData.order || !orderData.order.id) {
      options.onFailure('Failed to generate payment order on the server.');
      return;
    }

    const razorpayKeyId = orderData.keyId || orderData.order.keyId;
    if (!razorpayKeyId) {
      options.onFailure('Razorpay Key ID is not configured on the server.');
      return;
    }

    if (options.onOrderCreated) {
      options.onOrderCreated(orderData.internalOrderId || orderData.order.id, orderData.calculatedAmount);
    }

    // 2. Configure Razorpay checkout with UPI as the first block, followed by Cards, Netbanking, and Wallets
    const rzpOptions = {
      key: razorpayKeyId,
      amount: orderData.order.amount,
      currency: 'INR',
      name: 'VoiceCart Official Store',
      description: `Payment for Order #${orderData.internalOrderId || orderData.order.id}`,
      order_id: orderData.order.id,
      image: 'https://cdn-icons-png.flaticon.com/512/3081/3081840.png',
      prefill: {
        name: options.customer?.name || 'VoiceCart Shopper',
        email: options.customer?.email || 'shopper@voicecart.in',
        contact: options.customer?.phone || '9876543210'
      },
      notes: {
        internalOrderId: orderData.internalOrderId,
        paymentMode: orderData.paymentMode
      },
      theme: {
        color: '#6366f1',
        backdrop_color: 'rgba(15, 23, 42, 0.85)'
      },
      config: {
        display: {
          blocks: {
            upi: {
              name: 'Pay via UPI (GPay, PhonePe, Paytm, QR)',
              instruments: [
                {
                  method: 'upi'
                }
              ]
            },
            cards: {
              name: 'Credit / Debit Cards',
              instruments: [
                {
                  method: 'card'
                }
              ]
            },
            netbanking: {
              name: 'Netbanking',
              instruments: [
                {
                  method: 'netbanking'
                }
              ]
            },
            wallets: {
              name: 'Wallets & Other Modes',
              instruments: [
                {
                  method: 'wallet'
                }
              ]
            }
          },
          sequence: ['block.upi', 'block.cards', 'block.netbanking', 'block.wallets'],
          preferences: {
            show_default_blocks: true
          }
        }
      },
      modal: {
        confirm_close: true,
        ondismiss: () => {
          if (options.onDismiss) {
            options.onDismiss();
          }
        }
      },
      handler: async (response: {
        razorpay_payment_id: string;
        razorpay_order_id: string;
        razorpay_signature: string;
      }) => {
        try {
          // 3. Verify HMAC signature on backend
          const verifyRes = await api.verifyPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
            method: 'UPI / Direct Gateway'
          });

          if (verifyRes.success) {
            options.onSuccess({
              orderId: verifyRes.orderId || orderData.internalOrderId,
              paymentId: verifyRes.paymentId || response.razorpay_payment_id,
              amount: orderData.calculatedAmount,
              paidAt: verifyRes.paidAt || new Date().toISOString(),
              method: 'UPI / Razorpay Direct',
              order: verifyRes.order,
              paymentMode: verifyRes.paymentMode || orderData.paymentMode
            });
          } else {
            options.onFailure(verifyRes.message || 'Signature verification failed.');
          }
        } catch (verifyErr: any) {
          console.error('Verification call error:', verifyErr);
          options.onFailure(verifyErr?.response?.data?.error || 'Payment verification failed on server.');
        }
      }
    };

    const rzp = new (window as any).Razorpay(rzpOptions);
    rzp.on('payment.failed', (failResp: any) => {
      console.error('Razorpay payment failed:', failResp.error);
      options.onFailure(failResp.error?.description || 'Payment was declined or failed.');
    });

    rzp.open();
  } catch (err: any) {
    console.error('Checkout initialization error:', err);
    options.onFailure(err?.response?.data?.error || err.message || 'Payment initiation failed.');
  }
};
