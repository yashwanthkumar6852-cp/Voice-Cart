import React, { useState, useEffect } from 'react';
import { Search, Sparkles, Filter, SlidersHorizontal, RefreshCw, ShoppingCart, ExternalLink, ShieldCheck } from 'lucide-react';
import { CartItem, OrderRecord, Product, RankingPreference, SearchFilters, SearchResponse, StoreName, StoreStatus, VoiceIntentResult } from './types';
import { api } from './services/api';
import { Navbar, TabType } from './components/Navbar';
import { VoiceMicButton } from './components/VoiceMicButton';
import { ProductCard } from './components/ProductCard';
import { StoreComparisonTable } from './components/StoreComparisonTable';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartScreen } from './components/CartScreen';
import { OrdersScreen } from './components/OrdersScreen';
import { SettingsScreen } from './components/SettingsScreen';
import { translations, SupportedLanguage } from './i18n/translations';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>({
    preference: 'balanced',
    inStockOnly: true
  });

  const [isLoading, setIsLoading] = useState(false);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [storeStatuses, setStoreStatuses] = useState<StoreStatus[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const t = translations[language] || translations.en;

  // Initial load
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const [statuses, cartItems, ordersList] = await Promise.all([
        api.getStatuses(),
        api.getCart(),
        api.getOrders()
      ]);
      setStoreStatuses(statuses);
      setCart(cartItems);
      setOrders(ordersList);

      // Trigger initial search for wireless earbuds
      handleSearch('wireless earbuds', { maxBudget: 2000, preference: 'balanced' });
    } catch (err) {
      console.warn('Initial data load warning:', err);
    }
  };

  const handleSearch = async (query: string, customFilters?: SearchFilters) => {
    if (!query.trim()) return;
    setIsLoading(true);
    const activeFilters = customFilters || filters;
    try {
      const res = await api.search(query, activeFilters);
      setSearchResponse(res);
      setSearchQuery(query);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVoiceResult = async (result: {
    intentResult: VoiceIntentResult;
    searchData?: any;
    cartData?: any;
    orderData?: any;
  }) => {
    const { intentResult, searchData, cartData, orderData } = result;

    if (intentResult.language && ['en', 'hi', 'kn'].includes(intentResult.language)) {
      setLanguage(intentResult.language as SupportedLanguage);
    }

    if (searchData) {
      setSearchResponse(searchData);
      setSearchQuery(searchData.query);
      setActiveTab('search');
    }

    if (intentResult.intent === 'VIEW_CART') {
      setActiveTab('cart');
    }

    if (intentResult.intent === 'TRACK_ORDER') {
      setActiveTab('orders');
    }

    if (cartData) {
      setCart(cartData.cart);
    }

    if (orderData) {
      setOrders((prev) => {
        const exists = prev.find((o) => o.id === orderData.id);
        if (exists) return prev;
        return [orderData, ...prev];
      });
    }

    if (intentResult.intent === 'ADD_TO_CART' && searchResponse?.topRecommendations?.bestOverall) {
      handleAddToCart(searchResponse.topRecommendations.bestOverall);
    }
  };

  const handleAddToCart = async (product: Product) => {
    try {
      const res = await api.addToCart(product);
      setCart(res.cart);
    } catch (err) {
      console.error('Failed to add to cart:', err);
    }
  };

  const handleRemoveFromCart = async (id: string) => {
    try {
      const res = await api.removeFromCart(id);
      setCart(res.cart);
    } catch (err) {
      console.error('Failed to remove cart item:', err);
    }
  };

  const handleClearCart = async () => {
    try {
      await api.clearCart();
      setCart([]);
    } catch (err) {
      console.error('Failed to clear cart:', err);
    }
  };

  return (
    <div className="app-container" style={{ fontFamily: language === 'kn' ? "'Noto Sans Kannada', 'Inter', sans-serif" : "'Inter', sans-serif" }}>
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        cartCount={cart.reduce((s, i) => s + i.quantity, 0)}
      />

      {/* Hero Voice Hub (Visible on Home & Search) */}
      {(activeTab === 'home' || activeTab === 'search') && (
        <section
          className="glass-panel"
          style={{
            padding: '28px 20px',
            marginBottom: '28px',
            textAlign: 'center',
            background: 'var(--hero-bg)',
            border: '1px solid var(--hero-border)'
          }}
        >
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(6, 182, 212, 0.12)', border: '1px solid #06b6d4', color: '#06b6d4', padding: '4px 12px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, marginBottom: '16px' }}>
            <Sparkles size={14} /> {t.heroTag}
          </div>

          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '8px', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>
            {t.heroTitle}
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', maxWidth: '520px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            {t.heroSubtitle}
          </p>

          {/* Voice Microphone Controller with Kannada, Hindi, and English */}
          <VoiceMicButton
            language={language}
            onLanguageChange={setLanguage}
            onVoiceResult={handleVoiceResult}
            context={{
              selectedProduct: searchResponse?.topRecommendations?.bestOverall || selectedProduct,
              cart
            }}
          />

          {/* Search Input Box */}
          <div style={{ maxWidth: '600px', margin: '24px auto 0', position: 'relative' }}>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearch(searchQuery);
              }}
              style={{ display: 'flex', gap: '8px' }}
            >
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t.searchPlaceholder}
                  className="glass-input"
                  style={{ width: '100%', paddingLeft: '40px' }}
                />
                <Search size={18} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '14px' }} />
              </div>
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  background: 'linear-gradient(135deg, var(--primary), var(--primary-hover))',
                  border: 'none',
                  color: '#fff',
                  padding: '0 20px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {isLoading ? <RefreshCw size={16} className="mic-active-pulse" /> : <Search size={16} />}
                {t.searchBtn}
              </button>
            </form>

            {/* Quick Suggestions Chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px', marginTop: '12px' }}>
              {t.quickPills.map((pill, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSearch(pill)}
                  style={{
                    background: 'var(--bg-pill)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    padding: '4px 10px',
                    borderRadius: '14px',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    fontFamily: language === 'kn' ? "'Noto Sans Kannada', sans-serif" : 'inherit'
                  }}
                >
                  {pill}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Tab Views */}
      {(activeTab === 'home' || activeTab === 'search') && (
        <main>
          {/* Comparison Table */}
          {searchResponse?.comparisonMatrix && (
            <StoreComparisonTable
              comparisonMatrix={searchResponse.comparisonMatrix}
              storeStatuses={searchResponse.storeStatuses}
            />
          )}

          {/* Results Header with Sorting / Filter Options */}
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {searchResponse ? `${t.rankedResultsFor} "${searchResponse.query}"` : t.rankedResultsFor}
              </h3>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {searchResponse ? `${searchResponse.totalResults} ${t.liveItemsAnalyzed}` : ''}
              </span>
            </div>

            {/* Filter Preference Controls */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.rankBy}</span>
              {[
                { id: 'balanced', label: language === 'kn' ? 'ಸಮತೋಲಿತ' : language === 'hi' ? 'संतुलित' : 'Balanced' },
                { id: 'cheapest', label: language === 'kn' ? 'ಕಡಿಮೆ ಬೆಲೆ' : language === 'hi' ? 'कम कीमत' : 'Lowest Price' },
                { id: 'best_rated', label: language === 'kn' ? 'ಉತ್ತಮ ರೇಟಿಂಗ್' : language === 'hi' ? 'उच्च रेटिंग' : 'Best Rated' },
                { id: 'fastest', label: language === 'kn' ? 'ವೇಗ' : language === 'hi' ? 'तेज़' : 'Fastest' }
              ].map((pref) => (
                <button
                  key={pref.id}
                  onClick={() => {
                    const newFilters: SearchFilters = { ...filters, preference: pref.id as any };
                    setFilters(newFilters);
                    if (searchResponse?.query) {
                      handleSearch(searchResponse.query, newFilters);
                    }
                  }}
                  style={{
                    background: filters.preference === pref.id ? 'var(--primary)' : 'var(--bg-pill)',
                    border: '1px solid var(--border-color)',
                    color: filters.preference === pref.id ? '#fff' : 'var(--text-main)',
                    padding: '5px 10px',
                    borderRadius: '8px',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    cursor: 'pointer'
                  }}
                >
                  {pref.label}
                </button>
              ))}
            </div>
          </div>

          {/* Products Grid */}
          {isLoading ? (
            <div className="glass-panel" style={{ padding: '60px', textAlign: 'center' }}>
              <RefreshCw size={36} color="#6366f1" className="mic-active-pulse" style={{ margin: '0 auto 16px' }} />
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Fetching Live Store Data...</h4>
              <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Querying Amazon India, Flipkart & Meesho APIs in real-time</p>
            </div>
          ) : searchResponse?.products && searchResponse.products.length > 0 ? (
            <div className="products-grid">
              {searchResponse.products.map((product) => (
                <ProductCard
                  key={`${product.store}-${product.productId}`}
                  product={product}
                  onAddToCart={handleAddToCart}
                  onSelectProduct={setSelectedProduct}
                />
              ))}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ color: '#94a3b8' }}>No products found. Try changing your search query or budget filter.</p>
            </div>
          )}
        </main>
      )}

      {activeTab === 'cart' && (
        <CartScreen
          cart={cart}
          onRemoveItem={handleRemoveFromCart}
          onClearCart={handleClearCart}
          onCartUpdated={setCart}
          onAddToCart={handleAddToCart}
          onNavigateToOrders={() => setActiveTab('orders')}
          onOrderCompleted={(newOrder) => {
            setOrders((prev) => [newOrder, ...prev]);
          }}
        />
      )}

      {activeTab === 'orders' && (
        <OrdersScreen
          orders={orders}
          onOrderAdded={(order) => setOrders((prev) => [order, ...prev])}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsScreen
          storeStatuses={storeStatuses}
          language={language}
          onLanguageChange={setLanguage}
          preference={filters.preference || 'balanced'}
          onPreferenceChange={(pref) => setFilters((f) => ({ ...f, preference: pref }))}
        />
      )}

      {/* Product Detail Modal */}
      <ProductDetailModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onAddToCart={handleAddToCart}
      />
    </div>
  );
};
