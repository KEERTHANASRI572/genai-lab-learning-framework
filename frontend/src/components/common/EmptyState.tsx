import React from 'react';
import { Database, Inbox } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  isBackendPending?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records available',
  description = 'No persistent records have been populated for this view yet.',
  icon,
  actionLabel,
  onAction,
  isBackendPending = true,
}) => {
  return (
    <div className="empty-state glass-panel">
      <div className="empty-icon">
        {icon || (isBackendPending ? <Database size={24} /> : <Inbox size={24} />)}
      </div>
      <h4 className="empty-title">{title}</h4>
      <p className="empty-desc">{description}</p>
      {isBackendPending && (
        <div
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-accent)',
            background: 'rgba(99, 102, 241, 0.1)',
            padding: '4px 12px',
            borderRadius: 'var(--radius-full)',
            marginTop: '4px',
            border: '1px solid var(--border-accent)',
          }}
        >
          Phase 2 Foundation Active: Awaiting Phase 3/4 Application Models & Sync (No fake data injected)
        </div>
      )}
      {actionLabel && onAction && (
        <div style={{ marginTop: '12px' }}>
          <Button variant="outline" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
};
