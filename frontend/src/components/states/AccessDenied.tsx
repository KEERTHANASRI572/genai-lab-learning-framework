import React from 'react';
import { ShieldAlert, ArrowLeft, LogOut } from 'lucide-react';
import { Button } from '../common/Button';
import { useApp, defaultRoleViews } from '../../context/AppContext';

export const AccessDenied: React.FC<{ requiredRole?: string }> = ({ requiredRole }) => {
  const { user, setCurrentView, logout } = useApp();

  const handleReturn = () => {
    if (user?.role && defaultRoleViews[user.role]) {
      setCurrentView(defaultRoleViews[user.role]);
    } else {
      setCurrentView('login');
    }
  };

  return (
    <div className="glass-panel empty-state" style={{ maxWidth: 540, margin: '60px auto' }}>
      <div className="empty-icon" style={{ background: 'var(--danger-bg)', color: 'var(--danger)' }}>
        <ShieldAlert size={28} />
      </div>
      <h3 className="empty-title">Access Restricted by Institutional Policy</h3>
      <p className="empty-desc">
        Your authenticated session ({user?.role || 'Guest'}) does not have permission to access this protected domain or cross-institution resource.
        {requiredRole && ` This view requires the ${requiredRole} role.`}
      </p>
      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 12 }}>
        <Button variant="primary" size="sm" icon={<ArrowLeft size={14} />} onClick={handleReturn}>
          Return to Dashboard
        </Button>
        <Button variant="outline" size="sm" icon={<LogOut size={14} />} onClick={() => logout()}>
          Sign Out
        </Button>
      </div>
    </div>
  );
};
