import React, { useState } from 'react';
import { FileText, Search, ShieldCheck, Download, Filter } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';

interface AuditRow {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  institution: string;
  ipAddress: string;
  status: 'success' | 'failure';
}

export const PlatformAuditLogsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const initialLogs: AuditRow[] = [
    {
      id: 'aud_01',
      timestamp: '2026-10-20 07:56:42 UTC',
      actor: 'system.persistenceTest',
      role: 'SYSTEM',
      action: 'DB_PERSISTENCE_LIFECYCLE_VERIFICATION',
      institution: 'genai_lab_learning_db',
      ipAddress: '127.0.0.1',
      status: 'success',
    },
    {
      id: 'aud_02',
      timestamp: '2026-10-20 07:34:26 UTC',
      actor: 'health.probe',
      role: 'INFRASTRUCTURE',
      action: 'GET /api/health/ready [STATUS: READY]',
      institution: 'Global Gateway',
      ipAddress: '127.0.0.1',
      status: 'success',
    },
    {
      id: 'aud_03',
      timestamp: '2026-10-20 06:32:38 UTC',
      actor: 'server.bootstrap',
      role: 'SYSTEM',
      action: 'EXPRESS_HTTP_LISTENER_BOUND [PORT: 5000]',
      institution: 'Platform Core',
      ipAddress: '127.0.0.1',
      status: 'success',
    },
  ];

  const filtered = initialLogs.filter(
    (log) =>
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.institution.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Platform Audit Trail & Security Ledger
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Immutable, append-only security log recording tenant administrative actions, connection events, and system mutations.
          </p>
        </div>
        <Button variant="outline" size="sm" icon={<Download size={14} />}>
          Export Audit Ledger (CSV)
        </Button>
      </div>

      <div
        className="glass-panel"
        style={{
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Filter logs by actor, action keyword, or institution..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card padding={false}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Actor</th>
                <th>Role</th>
                <th>Action / Event</th>
                <th>Institution / Domain</th>
                <th>Origin IP</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.775rem' }}>
                      {log.timestamp}
                    </span>
                  </td>
                  <td><strong>{log.actor}</strong></td>
                  <td><Badge variant="neutral">{log.role}</Badge></td>
                  <td><code>{log.action}</code></td>
                  <td>{log.institution}</td>
                  <td><code>{log.ipAddress}</code></td>
                  <td>
                    {log.status === 'success' ? (
                      <Badge variant="success" dot>Verified</Badge>
                    ) : (
                      <Badge variant="danger" dot>Flagged</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          currentPage={currentPage}
          totalPages={1}
          totalItems={filtered.length}
          itemsPerPage={10}
          onPageChange={setCurrentPage}
        />
      </Card>
    </div>
  );
};
