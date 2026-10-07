import React from 'react';
import { StoreComparisonSummary, StoreStatus } from '../types';
import { ExternalLink, CheckCircle2, AlertCircle, Clock, Star } from 'lucide-react';

interface Props {
  comparisonMatrix: StoreComparisonSummary[];
  storeStatuses: StoreStatus[];
}

export const StoreComparisonTable: React.FC<Props> = ({ comparisonMatrix, storeStatuses }) => {
  return (
    <div className="glass-panel" style={{ padding: '20px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>⚖️ Live 3-Store Cross Comparison</span>
        </h3>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Real-time API Data</span>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '550px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>
              <th style={{ padding: '10px 12px' }}>Store Platform</th>
              <th style={{ padding: '10px 12px' }}>Lowest Deal Price</th>
              <th style={{ padding: '10px 12px' }}>Delivery Speed</th>
              <th style={{ padding: '10px 12px' }}>Customer Rating</th>
              <th style={{ padding: '10px 12px' }}>Platform Status</th>
              <th style={{ padding: '10px 12px', textAlign: 'right' }}>Official Store</th>
            </tr>
          </thead>
          <tbody>
            {comparisonMatrix.map((item) => {
              const status = storeStatuses.find((s) => s.store === item.store);
              const isAvailable = item.available && item.lowestPrice;

              return (
                <tr
                  key={item.store}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '0.9rem',
                    transition: 'background 0.2s ease'
                  }}
                >
                  <td style={{ padding: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          width: '10px',
                          height: '10px',
                          borderRadius: '50%',
                          backgroundColor:
                            item.store === 'amazon'
                              ? '#ff9900'
                              : item.store === 'flipkart'
                              ? '#2874f0'
                              : '#f43397'
                        }}
                      />
                      {item.storeDisplayName}
                    </div>
                  </td>

                  <td style={{ padding: '12px', fontWeight: 700, color: isAvailable ? 'var(--accent-green)' : 'var(--text-dim)' }}>
                    {isAvailable ? `₹${item.lowestPrice?.toLocaleString()}` : '—'}
                  </td>

                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                    {isAvailable ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} color="var(--secondary)" />
                        {item.fastestDeliveryDays === 1 ? '1 Day (Prime/Fast)' : `${item.fastestDeliveryDays} Days`}
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>

                  <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                    {isAvailable && item.avgRating ? (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Star size={14} fill="var(--accent-gold)" color="var(--accent-gold)" />
                        {item.avgRating} / 5.0
                      </span>
                    ) : (
                      '—'
                    )}
                  </td>

                  <td style={{ padding: '12px' }}>
                    {isAvailable ? (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--accent-green)',
                          fontSize: '0.78rem',
                          background: 'rgba(16, 185, 129, 0.1)',
                          padding: '3px 8px',
                          borderRadius: '12px'
                        }}
                      >
                        <CheckCircle2 size={13} /> Live Verified
                      </span>
                    ) : (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--accent-rose)',
                          fontSize: '0.78rem',
                          background: 'rgba(244, 63, 94, 0.1)',
                          padding: '3px 8px',
                          borderRadius: '12px'
                        }}
                        title={item.notice || status?.message}
                      >
                        <AlertCircle size={13} /> {item.store === 'meesho' ? 'Partner API Required' : 'Not Available'}
                      </span>
                    )}
                  </td>

                  <td style={{ padding: '12px', textAlign: 'right' }}>
                    {item.affiliateUrl ? (
                      <a
                        href={item.affiliateUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          color: 'var(--primary)',
                          textDecoration: 'none',
                          fontSize: '0.82rem',
                          fontWeight: 600
                        }}
                      >
                        Open <ExternalLink size={14} />
                      </a>
                    ) : (
                      <span style={{ color: 'var(--text-dim)', fontSize: '0.8rem' }}>N/A</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
