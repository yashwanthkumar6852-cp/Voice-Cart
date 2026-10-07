import React from 'react';
import { ShoppingBag, Search, Package, Settings, Mic, Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export type TabType = 'home' | 'search' | 'cart' | 'orders' | 'settings';

interface Props {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  cartCount: number;
}

export const Navbar: React.FC<Props> = ({ activeTab, onTabChange, cartCount }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <>
      {/* Top Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 0',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-color)'
        }}
      >
        <div
          onClick={() => onTabChange('home')}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 15px var(--primary-glow)'
            }}
          >
            <Mic size={22} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-main)' }}>
              Voice<span style={{ color: '#06b6d4' }}>Cart</span>
            </h1>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
              Live Amazon • Flipkart • Meesho
            </div>
          </div>
        </div>

        {/* Desktop Quick Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => onTabChange('search')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'search' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              border: activeTab === 'search' ? '1px solid var(--primary)' : '1px solid transparent',
              color: activeTab === 'search' ? 'var(--primary)' : 'var(--text-secondary)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Search size={16} /> Search & Compare
          </button>

          <button
            onClick={() => onTabChange('orders')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'orders' ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
              border: activeTab === 'orders' ? '1px solid var(--primary)' : '1px solid transparent',
              color: activeTab === 'orders' ? 'var(--primary)' : 'var(--text-secondary)',
              padding: '8px 14px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <Package size={16} /> Track Orders
          </button>

          <button
            onClick={() => onTabChange('cart')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: activeTab === 'cart' ? 'var(--primary)' : 'var(--bg-pill)',
              border: '1px solid var(--border-color)',
              color: activeTab === 'cart' ? '#fff' : 'var(--text-main)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '0.85rem',
              fontWeight: 700,
              cursor: 'pointer',
              position: 'relative'
            }}
          >
            <ShoppingBag size={16} />
            <span>Cart</span>
            {cartCount > 0 && (
              <span
                style={{
                  background: 'var(--accent-rose)',
                  color: '#fff',
                  borderRadius: '10px',
                  fontSize: '0.7rem',
                  padding: '2px 6px',
                  fontWeight: 800,
                  marginLeft: '2px'
                }}
              >
                {cartCount}
              </span>
            )}
          </button>

          {/* Theme Switcher Toggle */}
          <button
            onClick={toggleTheme}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'var(--bg-pill)',
              border: '1px solid var(--border-color)',
              color: theme === 'dark' ? '#fbbf24' : '#4f46e5',
              padding: '8px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            onClick={() => onTabChange('settings')}
            style={{
              background: activeTab === 'settings' ? 'rgba(99, 102, 241, 0.2)' : 'var(--bg-pill)',
              border: activeTab === 'settings' ? '1px solid var(--primary)' : '1px solid var(--border-color)',
              color: activeTab === 'settings' ? 'var(--primary)' : 'var(--text-muted)',
              padding: '8px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
            title="Settings & Status"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Mobile Bottom Fixed Tab Bar */}
      <nav
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-color)',
          padding: '8px 16px',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 90
        }}
      >
        {[
          { id: 'home', label: 'Voice', icon: Mic },
          { id: 'search', label: 'Compare', icon: Search },
          { id: 'cart', label: 'Cart', icon: ShoppingBag, badge: cartCount },
          { id: 'orders', label: 'Orders', icon: Package },
          { id: 'settings', label: 'Settings', icon: Settings }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id as TabType)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.72rem',
                fontWeight: isActive ? 700 : 500,
                cursor: 'pointer',
                position: 'relative'
              }}
            >
              <div style={{ position: 'relative' }}>
                <Icon size={20} />
                {tab.badge && tab.badge > 0 ? (
                  <span
                    style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '-8px',
                      background: 'var(--accent-rose)',
                      color: '#fff',
                      fontSize: '0.62rem',
                      borderRadius: '8px',
                      padding: '1px 5px',
                      fontWeight: 800
                    }}
                  >
                    {tab.badge}
                  </span>
                ) : null}
              </div>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
};
