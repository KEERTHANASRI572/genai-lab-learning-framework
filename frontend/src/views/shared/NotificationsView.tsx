import React from 'react';
import { Bell, CheckCircle2, AlertTriangle, LifeBuoy, Clock } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';

export const NotificationsView: React.FC = () => {
  const notifications = [
    {
      id: 1,
      title: 'Instructor Response Received',
      desc: 'Prof. Elena Rostova replied to your inquiry regarding Step 4 decade resistance selection.',
      time: '18 mins ago',
      type: 'info' as const,
    },
    {
      id: 2,
      title: 'Lab Manual Revision Available',
      desc: 'ECE Department updated safety protocols for Oscilloscope grounding in EXP-01.',
      time: '2 hours ago',
      type: 'warning' as const,
    },
    {
      id: 3,
      title: 'Topic Level Promoted: Advanced',
      desc: 'Your observational accuracy and 100% final quiz score promoted your RC Transients proficiency.',
      time: '1 day ago',
      type: 'success' as const,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Notifications & Activity Alerts
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Stay updated on instructor responses, curriculum revisions, and topic-level advancements.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {notifications.map((n) => (
          <Card key={n.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', gap: 14 }}>
                <div
                  style={{
                    padding: 8,
                    borderRadius: 'var(--radius-sm)',
                    background:
                      n.type === 'success'
                        ? 'var(--success-bg)'
                        : n.type === 'warning'
                        ? 'var(--warning-bg)'
                        : 'var(--info-bg)',
                    color:
                      n.type === 'success'
                        ? 'var(--success)'
                        : n.type === 'warning'
                        ? 'var(--warning)'
                        : 'var(--info)',
                  }}
                >
                  <Bell size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {n.title}
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {n.desc}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{n.time}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
