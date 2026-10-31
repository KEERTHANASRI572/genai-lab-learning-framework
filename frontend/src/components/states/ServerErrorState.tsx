import React from 'react';
import { ServerCrash, RefreshCw } from 'lucide-react';
import { Button } from '../common/Button';
import { useApp } from '../../context/AppContext';

export const ServerErrorState: React.FC<{ errorMessage?: string }> = ({
  errorMessage = 'Unable to establish secure handshake with the application gateway.',
}) => {
  const { refreshBackendHealth } = useApp();

  return (
    <div className="glass-panel empty-state" style={{ maxWidth: 540, margin: '60px auto' }}>
      <div className="empty-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
        <ServerCrash size={28} />
      </div>
      <h3 className="empty-title">Gateway Service Interruption</h3>
      <p className="empty-desc">{errorMessage}</p>
      <div style={{ marginTop: 16 }}>
        <Button variant="primary" size="sm" icon={<RefreshCw size={14} />} onClick={refreshBackendHealth}>
          Retry Gateway Health Check
        </Button>
      </div>
    </div>
  );
};
