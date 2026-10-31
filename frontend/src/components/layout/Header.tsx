import React from 'react';
import { Bell, Settings, RefreshCw, Cpu, LogOut } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Badge } from '../common/Badge';

export const Header: React.FC<{ onToggleSidebar?: () => void }> = () => {
  const {
    user,
    activeInstitution,
    backendHealth,
    refreshBackendHealth,
    setCurrentView,
    logout,
    activeExperimentCode,
    activeExperimentTitle,
  } = useApp();

  if (!user) return null;

  return (
    <header
      className="glass-panel"
      style={{
        height: 'var(--header-height)',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderRadius: 0,
        borderTop: 'none',
        borderLeft: 'none',
        borderRight: 'none',
        borderBottom: '1px solid var(--border-subtle)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: 'var(--bg-glass)',
        backdropFilter: 'blur(16px)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Cpu size={22} style={{ color: 'var(--brand-primary)' }} />
          <span style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>
            <span className="gradient-text">GenAI</span> Lab Learning
          </span>
        </div>

        <div style={{ height: 20, width: 1, backgroundColor: 'var(--border-subtle)' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Tenant:</span>
          <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            {activeInstitution || 'Global Platform'}
          </span>
        </div>

        {activeExperimentCode && (
          <>
            <div style={{ height: 20, width: 1, backgroundColor: 'var(--border-subtle)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Experiment:</span>
              <Badge variant="brand">{activeExperimentCode}</Badge>
              <span
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary)',
                  maxWidth: 240,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={activeExperimentTitle}
              >
                {activeExperimentTitle}
              </span>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {/* Live Backend Connection Indicator */}
        <div
          onClick={refreshBackendHealth}
          title={`Backend status: ${backendHealth.statusText} (Checked at ${backendHealth.checkedAt}). Click to refresh.`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            cursor: 'pointer',
            transition: 'border-color 0.15s ease',
          }}
        >
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: backendHealth.isReady
                ? 'var(--success)'
                : backendHealth.isLive
                ? 'var(--warning)'
                : 'var(--danger)',
              boxShadow: backendHealth.isReady
                ? '0 0 8px var(--success)'
                : backendHealth.isLive
                ? '0 0 8px var(--warning)'
                : '0 0 8px var(--danger)',
            }}
          />
          <span style={{ color: 'var(--text-secondary)' }}>
            {backendHealth.isReady
              ? 'Atlas Connected'
              : backendHealth.isLive
              ? 'Server Live'
              : 'Backend Offline'}
          </span>
          <RefreshCw size={11} style={{ opacity: 0.6 }} />
        </div>

        <Badge variant="brand" dot>
          {user.role.replace('-', ' ')}
        </Badge>

        <button
          onClick={() => setCurrentView('notifications')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="View notifications"
        >
          <Bell size={18} />
        </button>

        <button
          onClick={() => setCurrentView('settings')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 6,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label="User settings"
        >
          <Settings size={18} />
        </button>

        <div style={{ height: 20, width: 1, backgroundColor: 'var(--border-subtle)' }} />

        {/* User Card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: 'var(--brand-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '0.8rem',
              color: '#ffffff',
            }}
          >
            {user.name.charAt(0)}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.825rem', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              {user.name}
            </span>
            <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
              {user.email}
            </span>
          </div>
        </div>

        <button
          onClick={() => logout()}
          title="Sign out of institutional session"
          style={{
            background: 'rgba(239, 68, 68, 0.12)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: 'var(--danger)',
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: '0.75rem',
            fontWeight: 600,
            transition: 'background 0.15s ease',
          }}
          aria-label="Sign out"
        >
          <LogOut size={14} />
          <span>Sign Out</span>
        </button>
      </div>
    </header>
  );
};
