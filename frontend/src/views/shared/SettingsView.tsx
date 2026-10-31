import React from 'react';
import { Settings, Shield, User, Building, Bell, Moon } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { FormField } from '../../components/common/FormField';
import { useApp } from '../../context/AppContext';

export const SettingsView: React.FC = () => {
  const { user, activeInstitution } = useApp();

  if (!user) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Profile & Application Preferences
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Manage your personal workspace preferences, notification rules, and institutional credentials.
        </p>
      </div>

      <div className="grid-2">
        <Card title="Account Details" subtitle="Verified institutional profile">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <FormField label="Full Name">
              <input type="text" className="form-input" value={user.name} readOnly />
            </FormField>
            <FormField label="Institutional Email">
              <input type="email" className="form-input" value={user.email} readOnly />
            </FormField>
            <FormField label="Tenant Affiliation">
              <input type="text" className="form-input" value={activeInstitution} readOnly />
            </FormField>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 }}>
              <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Assigned Role:</span>
              <Badge variant="brand">{user.role.replace('-', ' ').toUpperCase()}</Badge>
            </div>
          </div>
        </Card>

        <Card title="Interface & AI Tutor Preferences" subtitle="Scaffolding and accessibility parameters">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Automated Safety Checklist Prompts</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Require safety check validation before each apparatus step</div>
              </div>
              <Badge variant="success">Always Enforced</Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>AI Guidance Verbosity</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Calibrated dynamically by your topic proficiency level</div>
              </div>
              <Badge variant="neutral">Adaptive</Badge>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>High-Contrast Laboratory Mode</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Optimized visibility for bright bench lighting environments</div>
              </div>
              <Badge variant="neutral">Dark Slate (Default)</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
