import React from 'react';
import { LifeBuoy, Plus, MessageSquare, Clock, CheckCircle2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';

export const StudentSupportView: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            My Laboratory Help Requests & Support
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Track instructor responses to inquiries escalated during interactive laboratory practice.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />}>
          Submit New Inquiry
        </Button>
      </div>

      <Card padding={false}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Experiment & Step</th>
                <th>Inquiry Subject</th>
                <th>Assigned Instructor</th>
                <th>Status</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>EXP-01 [Step 4]</strong></td>
                <td>
                  <strong>Decade resistance multiplier selection query</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Instructor confirmed that decade dials are additive in series.
                  </div>
                </td>
                <td>Prof. Elena Rostova</td>
                <td><Badge variant="success" dot>Answered</Badge></td>
                <td>Today, 11:42 AM</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
