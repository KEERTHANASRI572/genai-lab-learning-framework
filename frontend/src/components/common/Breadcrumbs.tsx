import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { BreadcrumbItem, AppView } from '../../types/navigation';
import { useApp } from '../../context/AppContext';

export const Breadcrumbs: React.FC = () => {
  const { breadcrumbs, setCurrentView } = useApp();

  return (
    <nav
      aria-label="Breadcrumbs"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        marginBottom: 16,
      }}
    >
      <Home size={14} style={{ color: 'var(--text-muted)' }} />
      {breadcrumbs.map((item: BreadcrumbItem, index: number) => {
        const isLast = index === breadcrumbs.length - 1;
        return (
          <React.Fragment key={index}>
            <ChevronRight size={12} style={{ opacity: 0.5 }} />
            {item.view && !isLast ? (
              <button
                onClick={() => item.view && setCurrentView(item.view)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontSize: 'inherit',
                  padding: 0,
                  textDecoration: 'none',
                }}
              >
                {item.label}
              </button>
            ) : (
              <span style={{ color: isLast ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isLast ? 500 : 400 }}>
                {item.label}
              </span>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
};
