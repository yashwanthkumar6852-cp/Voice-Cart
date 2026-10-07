import React from 'react';
import { Star, ShoppingCart, ExternalLink, Tag, Truck } from 'lucide-react';
import { Product } from '../types';

interface Props {
  product: Product;
  onAddToCart: (product: Product) => void;
  onSelectProduct: (product: Product) => void;
}

export const ProductCard: React.FC<Props> = ({ product, onAddToCart, onSelectProduct }) => {
  const storeBadgeStyles: Record<string, { bg: string; text: string; label: string }> = {
    amazon: { bg: '#ff9900', text: '#000', label: 'Amazon India' },
    flipkart: { bg: '#2874f0', text: '#fff', label: 'Flipkart' },
    meesho: { bg: '#f43397', text: '#fff', label: 'Meesho' }
  };

  const storeInfo = storeBadgeStyles[product.store] || { bg: 'var(--primary)', text: '#fff', label: product.store };

  return (
    <div
      className="glass-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        border: product.badges?.includes('Best Overall') ? '1.5px solid var(--accent-gold)' : '1px solid var(--border-color)',
        boxShadow: product.badges?.includes('Best Overall') ? '0 10px 30px rgba(245, 158, 11, 0.2)' : 'var(--shadow-card)'
      }}
    >
      {/* Top Standout Badge */}
      {product.badges && product.badges.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '12px',
            zIndex: 2,
            display: 'flex',
            gap: '6px'
          }}
        >
          {product.badges.map((badge, idx) => (
            <span
              key={idx}
              className={
                badge === 'Best Overall' ? 'badge-best' : badge === 'Lowest Price' ? 'badge-cheapest' : 'badge-fastest'
              }
              style={{
                fontSize: '0.72rem',
                padding: '4px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
              }}
            >
              {badge === 'Best Overall' && '⭐ '}
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Store Source Tag */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          zIndex: 2,
          backgroundColor: storeInfo.bg,
          color: storeInfo.text,
          fontSize: '0.72rem',
          fontWeight: 700,
          padding: '3px 9px',
          borderRadius: '12px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
        }}
      >
        {storeInfo.label}
      </div>

      {/* Product Image */}
      <div
        onClick={() => onSelectProduct(product)}
        style={{
          height: '190px',
          background: 'var(--img-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
          cursor: 'pointer',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <img
          src={product.imageUrl}
          alt={product.title}
          style={{
            maxHeight: '100%',
            maxWidth: '100%',
            objectFit: 'contain',
            transition: 'transform 0.3s ease'
          }}
          onError={(e: any) => {
            e.target.src = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400&auto=format&fit=crop&q=80';
          }}
        />
      </div>

      {/* Content Body */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        <h4
          onClick={() => onSelectProduct(product)}
          style={{
            fontSize: '0.95rem',
            fontWeight: 600,
            lineHeight: 1.4,
            marginBottom: '8px',
            color: 'var(--text-main)',
            cursor: 'pointer',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            minHeight: '2.8em'
          }}
        >
          {product.title}
        </h4>

        {/* Rating & Delivery Info */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '2px',
                background: '#047857',
                color: '#fff',
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: '4px'
              }}
            >
              {product.rating} <Star size={12} fill="#fff" color="#fff" />
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              ({product.ratingCount.toLocaleString()})
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--secondary)' }}>
            <Truck size={14} />
            <span>{product.deliveryDays === 1 ? 'Next Day' : `${product.deliveryDays} Days`}</span>
          </div>
        </div>

        {/* Price Section */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '8px' }}>
          <span style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)' }}>
            ₹{product.price.toLocaleString()}
          </span>
          {product.mrp > product.price && (
            <span style={{ fontSize: '0.85rem', color: 'var(--text-dim)', textDecoration: 'line-through' }}>
              ₹{product.mrp.toLocaleString()}
            </span>
          )}
          {product.discountPct > 0 && (
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-green)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <Tag size={12} /> {product.discountPct}% OFF
            </span>
          )}
        </div>

        {/* AI Explainable Reason Snippet */}
        {product.reason && (
          <div
            style={{
              fontSize: '0.78rem',
              color: 'var(--text-secondary)',
              background: 'rgba(99, 102, 241, 0.1)',
              borderLeft: '3px solid var(--primary)',
              padding: '6px 10px',
              borderRadius: '0 6px 6px 0',
              marginBottom: '14px',
              lineHeight: 1.35
            }}
          >
            {product.reason}
          </div>
        )}

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px', marginTop: 'auto' }}>
          <button
            onClick={() => onAddToCart(product)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: 'var(--bg-subtle)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-main)',
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'background 0.2s ease, border-color 0.2s ease'
            }}
          >
            <ShoppingCart size={15} />
            Add to Cart
          </button>

          <a
            href={product.affiliateUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: storeInfo.bg,
              color: storeInfo.text,
              padding: '10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.82rem',
              fontWeight: 700,
              textDecoration: 'none',
              cursor: 'pointer'
            }}
          >
            <ExternalLink size={15} />
            Buy on {product.store === 'amazon' ? 'Amazon' : product.store === 'flipkart' ? 'Flipkart' : 'Meesho'}
          </a>
        </div>
      </div>
    </div>
  );
};
