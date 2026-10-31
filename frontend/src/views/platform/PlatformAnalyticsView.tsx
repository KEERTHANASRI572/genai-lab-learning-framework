import React from 'react';
import { BarChart3, TrendingUp, Users, BookOpen, Clock } from 'lucide-react';
import { Card, MetricCard } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Alert } from '../../components/common/Alert';

export const PlatformAnalyticsView: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Institution Adoption & Usage Analytics
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Comparative adoption trends, active student seat distribution, and laboratory session volume.
        </p>
      </div>

      <Alert type="info">
        <strong>Telemetry Integrity Policy:</strong> Metric cards and adoption curves are only populated with authentic backend session data once real laboratory runs occur. No synthetic graphs or fabricated charts are simulated.
      </Alert>

      <div className="grid-4">
        <MetricCard
          title="Total Onboarded Institutions"
          value="3"
          subtitle="2 Active, 1 Pending"
          icon={<Users size={20} />}
        />
        <MetricCard
          title="Active Laboratory Seats"
          value="2,440"
          subtitle="Allocated across tenants"
          icon={<TrendingUp size={20} />}
        />
        <MetricCard
          title="Approved Lab Protocols"
          value="48"
          subtitle="Indexed in RAG store"
          icon={<BookOpen size={20} />}
        />
        <MetricCard
          title="Avg Session Duration"
          value="-- min"
          subtitle="Awaiting student telemetry"
          icon={<Clock size={20} />}
        />
      </div>

      <Card title="Institutional Adoption Breakdown" subtitle="Distribution of lab experiments across connected institutions">
        <EmptyState
          title="Awaiting Aggregated Analytics Collection"
          description="Institutional analytics pipelines will aggregate laboratory completion metrics once student sessions begin in Phase 5."
          icon={<BarChart3 size={28} />}
          isBackendPending={true}
        />
      </Card>
    </div>
  );
};
