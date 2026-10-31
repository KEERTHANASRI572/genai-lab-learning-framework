import React, { useState } from 'react';
import { LifeBuoy, AlertTriangle, ShieldCheck, CheckCircle2, Search, Filter } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';

interface TicketItem {
  id: string;
  ticketNumber: string;
  institution: string;
  requester: string;
  subject: string;
  category: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'escalated' | 'resolved';
  updatedAt: string;
}

export const PlatformSupportView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  const tickets: TicketItem[] = [
    {
      id: 'tkt_01',
      ticketNumber: 'ESC-2026-0042',
      institution: 'Apex Institute of Technology',
      requester: 'Prof. Elena Rostova',
      subject: 'Hallucination flag on Experiment #4 circuit resistance calculation',
      category: 'AI Verification',
      priority: 'high',
      status: 'investigating',
      updatedAt: '25 mins ago',
    },
    {
      id: 'tkt_02',
      ticketNumber: 'ESC-2026-0038',
      institution: 'Metropolitan Engineering University',
      requester: 'Dean Arthur Vance',
      subject: 'Quota increase request for Fall Laboratory Semester (2M -> 5M tokens)',
      category: 'Quota Request',
      priority: 'medium',
      status: 'open',
      updatedAt: '2 hours ago',
    },
  ];

  const filtered = tickets.filter((t) => {
    const matchesSearch =
      t.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.institution.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Platform Support & Escalation Queue
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Triage institution-level support tickets, AI accuracy flags, and cross-tenant escalation requests.
        </p>
      </div>

      <div
        className="glass-panel"
        style={{
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 260 }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search tickets by subject, ticket #, or college..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Priority:</span>
          <select
            className="form-select"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      <Card padding={false}>
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Ticket #</th>
                <th>Subject & Category</th>
                <th>Institution</th>
                <th>Requester</th>
                <th>Priority</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((ticket) => (
                <tr key={ticket.id}>
                  <td><code>{ticket.ticketNumber}</code></td>
                  <td>
                    <div>
                      <div style={{ fontWeight: 600 }}>{ticket.subject}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Category: {ticket.category} · Updated {ticket.updatedAt}
                      </div>
                    </div>
                  </td>
                  <td>{ticket.institution}</td>
                  <td>{ticket.requester}</td>
                  <td>
                    {ticket.priority === 'high' && <Badge variant="danger">High</Badge>}
                    {ticket.priority === 'medium' && <Badge variant="warning">Medium</Badge>}
                    {ticket.priority === 'critical' && <Badge variant="danger" dot>Critical</Badge>}
                    {ticket.priority === 'low' && <Badge variant="neutral">Low</Badge>}
                  </td>
                  <td>
                    {ticket.status === 'investigating' && (
                      <Badge variant="warning" dot>Investigating</Badge>
                    )}
                    {ticket.status === 'open' && (
                      <Badge variant="info" dot>Open</Badge>
                    )}
                    {ticket.status === 'resolved' && (
                      <Badge variant="success" dot>Resolved</Badge>
                    )}
                  </td>
                  <td>
                    <Button variant="outline" size="sm">Manage Ticket</Button>
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
