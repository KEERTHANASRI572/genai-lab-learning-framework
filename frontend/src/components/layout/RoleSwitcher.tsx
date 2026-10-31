import React from 'react';
import { Shield } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const RoleSwitcher: React.FC = () => {
  const { currentRole, activeInstitution } = useApp();

  return (
    <div
      className="glass-panel"
      style={{
        padding: '8px 16px',
        marginBottom: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '0.8rem',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Shield size={14} style={{ color: 'var(--brand-primary)' }} />
        <span>Authenticated Role: <strong>{currentRole || 'Unauthenticated'}</strong></span>
      </div>
      <div>
        <span>Tenant: <strong>{activeInstitution || 'Global'}</strong></span>
      </div>
    </div>
  );
};
