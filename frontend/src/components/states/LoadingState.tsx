import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingState: React.FC<{ message?: string }> = ({
  message = 'Loading environment data...',
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '64px 20px',
        gap: 16,
      }}
    >
      <Loader2
        size={36}
        style={{
          color: 'var(--brand-primary)',
          animation: 'spin 1s linear infinite',
        }}
      />
      <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{message}</span>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};
