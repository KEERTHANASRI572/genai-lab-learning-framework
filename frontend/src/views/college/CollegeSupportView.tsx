import React, { useState, useEffect, useCallback } from 'react';
import {
  LifeBuoy,
  Plus,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Eye,
  Edit2,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { EmptyState } from '../../components/common/EmptyState';
import { ModalDialog } from '../../components/common/ModalDialog';
import {
  listSupportTickets,
  createSupportTicket,
  updateSupportTicketStatus,
  getDepartments,
  SupportTicketDto,
  DepartmentDto,
} from '../../services/api';

export const CollegeSupportView: React.FC = () => {
  const [tickets, setTickets] = useState<SupportTicketDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // New Ticket Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [deptId, setDeptId] = useState('');
  const [priority, setPriority] = useState('medium');

  // View / Update Status Modal State
  const [selectedTicket, setSelectedTicket] = useState<SupportTicketDto | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<'open' | 'in_progress' | 'resolved' | 'closed'>('open');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listSupportTickets({
        status: statusFilter !== 'all' ? statusFilter : undefined,
      });
      if (res.success && res.data) {
        setTickets(res.data);
      } else {
        setError(res.error?.message || 'Failed to load support tickets.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchDepts = useCallback(async () => {
    try {
      const res = await getDepartments();
      if (res.success && res.data) {
        setDepartments(res.data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchTickets();
    fetchDepts();
  }, [fetchTickets, fetchDepts]);

  const handleOpenCreate = () => {
    setSubject('');
    setDescription('');
    setDeptId(departments.length > 0 ? departments[0]._id : '');
    setPriority('medium');
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || subject.trim().length < 3) {
      setCreateError('Subject must be at least 3 characters.');
      return;
    }
    if (!description.trim() || description.trim().length < 5) {
      setCreateError('Description must be at least 5 characters.');
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const res = await createSupportTicket({
        subject: subject.trim(),
        description: description.trim(),
        departmentId: deptId || undefined,
        priority,
      });

      if (res.success) {
        setIsCreateOpen(false);
        await fetchTickets();
      } else {
        setCreateError(res.error?.message || 'Failed to submit support ticket.');
      }
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const handleOpenDetails = (ticket: SupportTicketDto) => {
    setSelectedTicket(ticket);
    setNewStatus(ticket.status);
    setResolutionNotes(ticket.resolutionNotes || '');
    setIsDetailsOpen(true);
  };

  const handleUpdateStatusSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setUpdatingStatus(true);
    try {
      const res = await updateSupportTicketStatus(selectedTicket._id, {
        status: newStatus,
        resolutionNotes: resolutionNotes.trim() || undefined,
      });

      if (res.success) {
        setIsDetailsOpen(false);
        setSelectedTicket(null);
        await fetchTickets();
      } else {
        alert(res.error?.message || 'Failed to update ticket status.');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const filteredTickets = tickets.filter((t) => {
    const q = searchTerm.toLowerCase();
    return (
      t.ticketNumber.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.description.toLowerCase().includes(q) ||
      (t.departmentId?.name && t.departmentId.name.toLowerCase().includes(q)) ||
      (t.departmentId?.code && t.departmentId.code.toLowerCase().includes(q)) ||
      (t.submittedByUserId?.name && t.submittedByUserId.name.toLowerCase().includes(q))
    );
  });

  const getPriorityBadge = (p: string) => {
    switch (p) {
      case 'urgent':
        return <Badge variant="danger">Urgent</Badge>;
      case 'high':
        return <Badge variant="warning">High</Badge>;
      case 'low':
        return <Badge variant="neutral">Low</Badge>;
      default:
        return <Badge variant="info">Medium</Badge>;
    }
  };

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'resolved':
        return <Badge variant="success" dot>Resolved</Badge>;
      case 'in_progress':
        return <Badge variant="warning" dot>In Progress</Badge>;
      case 'closed':
        return <Badge variant="neutral" dot>Closed</Badge>;
      default:
        return <Badge variant="info" dot>Open</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            College Support Requests & Operational Ledger
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Internal college escalations, instructor technical support, and platform administration tickets.
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={handleOpenCreate}>
          File Support Ticket
        </Button>
      </div>

      {error && (
        <Alert type="danger" title="Error Loading Support Tickets">
          {error}
        </Alert>
      )}

      {/* Filter / Search Bar */}
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
            placeholder="Search tickets by ticket ID, subject, or submitter..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <select
            className="form-input"
            style={{ width: 'auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchTickets}>
            Refresh
          </Button>
        </div>
      </div>

      <Card padding={false}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading tickets from MongoDB Atlas...
          </div>
        ) : filteredTickets.length === 0 ? (
          <EmptyState
            title={searchTerm || statusFilter !== 'all' ? 'No Matching Support Tickets' : 'No Support Tickets Found'}
            description={
              searchTerm || statusFilter !== 'all'
                ? 'No tickets matched your filter criteria.'
                : 'No operational or technical support tickets have been filed for this institution yet. Click "File Support Ticket" above to submit one.'
            }
            icon={<LifeBuoy size={36} />}
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Ticket ID</th>
                  <th>Subject</th>
                  <th>Department</th>
                  <th>Submitted By</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTickets.map((t) => (
                  <tr key={t._id}>
                    <td>
                      <code>{t.ticketNumber}</code>
                    </td>
                    <td>
                      <div>
                        <strong>{t.subject}</strong>
                        <div
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)',
                            maxWidth: 320,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {t.description}
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>
                        {t.departmentId ? t.departmentId.code || t.departmentId.name : 'General'}
                      </strong>
                    </td>
                    <td>
                      <div>{t.submittedByUserId?.name || 'Authorized User'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {t.submittedByUserId?.role || ''}
                      </div>
                    </td>
                    <td>{getPriorityBadge(t.priority)}</td>
                    <td>{getStatusBadge(t.status)}</td>
                    <td>{new Date(t.createdAt).toLocaleDateString()}</td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Eye size={14} />}
                        onClick={() => handleOpenDetails(t)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* File Support Ticket Modal */}
      <ModalDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="File Support Ticket"
        description="Submit an operational issue, laboratory apparatus request, or platform support ticket."
        maxWidth="540px"
      >
        <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {createError && <Alert type="danger">{createError}</Alert>}

          <div>
            <label className="form-label">
              Subject <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Lab manual vector chunk verification issue"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Department</label>
              <select
                className="form-input"
                value={deptId}
                onChange={(e) => setDeptId(e.target.value)}
              >
                <option value="">General / Institution-wide</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Priority</label>
              <select
                className="form-input"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">
              Description <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              className="form-input"
              rows={4}
              placeholder="Provide complete details about the issue or request..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="ghost" onClick={() => setIsCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={creating} icon={<Plus size={14} />}>
              {creating ? 'Submitting...' : 'Submit Ticket'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Ticket Details & Status Update Modal */}
      <ModalDialog
        isOpen={isDetailsOpen && !!selectedTicket}
        onClose={() => setIsDetailsOpen(false)}
        title={selectedTicket ? `Ticket: ${selectedTicket.ticketNumber}` : 'Ticket Details'}
        description={selectedTicket?.subject}
        maxWidth="580px"
      >
        {selectedTicket && (
          <form onSubmit={handleUpdateStatusSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: 14, borderRadius: 'var(--radius-sm)' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                Description
              </div>
              <div style={{ color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}>
                {selectedTicket.description}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: '0.8rem' }}>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Department: </span>
                <strong>{selectedTicket.departmentId ? selectedTicket.departmentId.name : 'General'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Priority: </span>
                {getPriorityBadge(selectedTicket.priority)}
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Submitted By: </span>
                <strong>{selectedTicket.submittedByUserId?.name || 'User'}</strong>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Date: </span>
                <strong>{new Date(selectedTicket.createdAt).toLocaleString()}</strong>
              </div>
            </div>

            <hr style={{ borderColor: 'var(--border-subtle)', margin: '4px 0' }} />

            <div>
              <label className="form-label">Update Ticket Status</label>
              <select
                className="form-input"
                value={newStatus}
                onChange={(e) =>
                  setNewStatus(e.target.value as 'open' | 'in_progress' | 'resolved' | 'closed')
                }
              >
                <option value="open">Open</option>
                <option value="in_progress">In Progress</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div>
              <label className="form-label">Resolution / Action Notes</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Document any actions taken or notes regarding this ticket..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
              <Button variant="ghost" onClick={() => setIsDetailsOpen(false)} disabled={updatingStatus}>
                Close
              </Button>
              <Button variant="primary" type="submit" disabled={updatingStatus} icon={<CheckCircle2 size={14} />}>
                {updatingStatus ? 'Updating...' : 'Save Ticket Status'}
              </Button>
            </div>
          </form>
        )}
      </ModalDialog>
    </div>
  );
};
