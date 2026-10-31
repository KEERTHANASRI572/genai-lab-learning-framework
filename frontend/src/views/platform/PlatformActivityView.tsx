import React, { useState } from 'react';
import { Activity, Filter, Calendar, RefreshCw } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { EmptyState } from '../../components/common/EmptyState';
import { Alert } from '../../components/common/Alert';

export const PlatformActivityView: React.FC = () => {
  const [timeframe, setTimeframe] = useState('24h');
  const [institutionFilter, setInstitutionFilter] = useState('all');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Platform-Wide Activity Stream
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            High-level audit and event stream capturing cross-institution operational lifecycles.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            className="form-select"
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="1h">Past 1 Hour</option>
            <option value="24h">Past 24 Hours</option>
            <option value="7d">Past 7 Days</option>
            <option value="30d">Past 30 Days</option>
          </select>
          <Button variant="outline" size="sm" icon={<RefreshCw size={14} />}>
            Refresh
          </Button>
        </div>
      </div>

      <Alert type="info">
        <strong>Privacy & Cross-Institution Boundary Guarantee:</strong> Platform administrators can view high-level institutional platform usage and system events. Cross-institution access to confidential student grades, submissions, or identifiable records is strictly prohibited by default.
      </Alert>

      {/* Real telemetry stream placeholder without fake generated events */}
      <Card title="Real-Time Event Stream" subtitle="Awaiting persistent audit log stream from MongoDB backend">
        <EmptyState
          title="No Active Audit Events in Selected Window"
          description="The backend audit ledger is active. No security anomalies or administrative escalations have been logged for this timeframe."
          icon={<Activity size={28} />}
          isBackendPending={true}
        />
      </Card>
    </div>
  );
};
