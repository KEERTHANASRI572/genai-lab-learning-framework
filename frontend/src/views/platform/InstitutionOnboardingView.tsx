import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Search,
  Building2,
  AlertCircle,
  RefreshCw,
  Edit2,
  ShieldAlert,
  CheckCircle2,
  Trash2,
  AlertTriangle,
  Send,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { ModalDialog } from '../../components/common/ModalDialog';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/common/Alert';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import {
  getInstitutions,
  createInstitution,
  updateInstitution,
  suspendInstitution,
  reactivateInstitution,
  deleteInstitutionPermanently,
  resendInstitutionAdminInvitation,
  InstitutionDto,
} from '../../services/api';
import { INSTITUTION_TYPE_OPTIONS, formatInstitutionType } from '../../types/platform';

export const InstitutionOnboardingView: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);

  // Async States
  const [institutions, setInstitutions] = useState<InstitutionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form State (New)
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    domain: '',
    type: 'university',
    otherInstitutionType: '',
    adminEmail: '',
    isolationMode: 'logical_strict',
  });

  // Edit State
  const [editingInst, setEditingInst] = useState<InstitutionDto | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    code: '',
    domain: '',
    adminEmail: '',
    type: 'university',
    otherInstitutionType: '',
    contactPhone: '',
    status: 'active' as 'active' | 'pending_activation' | 'suspended',
  });

  // Permanent Delete State
  const [deletingInst, setDeletingInst] = useState<InstitutionDto | null>(null);
  const [confirmDeleteName, setConfirmDeleteName] = useState('');
  const [deleteDependencyError, setDeleteDependencyError] = useState<string | null>(null);

  const loadInstitutions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getInstitutions({
        status: statusFilter,
        search: searchTerm,
      });

      if (res.success && res.data) {
        setInstitutions(res.data);
      } else if (res.error) {
        setError(`${res.error.code}: ${res.error.message}`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to connect to backend service.';
      setError(`CONNECTION_ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchTerm]);

  useEffect(() => {
    loadInstitutions();
  }, [loadInstitutions]);

  const handleOnboardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessNotice(null);

    const isOther = formData.type === 'other' || formData.type === 'other_institution_type';
    if (isOther && !formData.otherInstitutionType.trim()) {
      setError('Please specify the custom institution type when "Other Institution Type" is selected.');
      setSubmitting(false);
      return;
    }

    const res = await createInstitution({
      name: formData.name.trim(),
      code: formData.code.trim().toUpperCase(),
      domain: formData.domain.trim().toLowerCase(),
      type: formData.type,
      otherInstitutionType: isOther ? formData.otherInstitutionType.trim() : undefined,
      adminEmail: formData.adminEmail.trim().toLowerCase(),
    });

    setSubmitting(false);

    if (res.success && res.data) {
      setIsModalOpen(false);
      const resPayload = res.data as any;
      const instData = resPayload.institution || resPayload;
      const delivery = resPayload.emailDelivery;
      let deliveryMsg = '';
      if (delivery) {
        if (delivery.delivered) {
          deliveryMsg = ` College Admin activation email dispatched to ${delivery.recipient}.`;
        } else {
          deliveryMsg = ` (SMTP ${delivery.reason === 'EMAIL_SERVICE_UNCONFIGURED' ? 'unconfigured' : 'delivery failed'}; College Admin account is created and pending activation.)`;
        }
      }

      setSuccessNotice(`Institution "${instData.name}" (Code: ${instData.code}) onboarded successfully.${deliveryMsg}`);
      setFormData({
        name: '',
        code: '',
        domain: '',
        type: 'university',
        otherInstitutionType: '',
        adminEmail: '',
        isolationMode: 'logical_strict',
      });
      loadInstitutions();
    } else if (res.error) {
      setError(`${res.error.code}: ${res.error.message}`);
    }
  };

  const handleOpenEdit = (inst: InstitutionDto) => {
    setEditingInst(inst);
    setEditFormData({
      name: inst.name,
      code: inst.code,
      domain: inst.domain,
      adminEmail: inst.adminEmail || '',
      type: inst.type,
      otherInstitutionType: inst.otherInstitutionType || '',
      contactPhone: inst.contactPhone || '',
      status: inst.status === 'trial' ? 'active' : inst.status,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingInst) return;

    setSubmitting(true);
    setError(null);
    setSuccessNotice(null);

    const isOther = editFormData.type === 'other' || editFormData.type === 'other_institution_type';
    if (isOther && !editFormData.otherInstitutionType.trim()) {
      setError('Please specify the custom institution type when "Other Institution Type" is selected.');
      setSubmitting(false);
      return;
    }

    const payload: Partial<InstitutionDto> = {
      name: editFormData.name.trim(),
      code: editFormData.code.trim().toUpperCase(),
      domain: editFormData.domain.trim().toLowerCase(),
      adminEmail: editFormData.adminEmail.trim().toLowerCase(),
      type: editFormData.type,
      otherInstitutionType: isOther ? editFormData.otherInstitutionType.trim() : undefined,
      contactPhone: editFormData.contactPhone.trim() || undefined,
      status: editFormData.status,
    };

    const res = await updateInstitution(editingInst._id, payload);

    setSubmitting(false);

    if (res.success && res.data) {
      setIsEditModalOpen(false);
      const resData = res.data as any;
      let emailNote = '';
      if (resData.emailDelivery) {
        if (resData.emailDelivery.delivered) {
          emailNote = ` Fresh activation link dispatched to new College Admin email (${resData.emailDelivery.recipient}).`;
        } else {
          emailNote = ` College Admin email updated. (SMTP unconfigured/offline, activation token refreshed).`;
        }
      }
      setSuccessNotice(`Institution "${resData.name}" updated successfully.${emailNote}`);
      loadInstitutions();
    } else if (res.error) {
      setError(`${res.error.code}: ${res.error.message}`);
    }
  };

  const handleToggleSuspend = async (inst: InstitutionDto) => {
    const isSuspending = inst.status !== 'suspended';
    const confirmMsg = isSuspending
      ? `Are you sure you want to suspend "${inst.name}"? Active users will not be able to log in until reactivated.`
      : `Reactivate "${inst.name}" so users can access their workspaces?`;

    if (!window.confirm(confirmMsg)) return;

    setError(null);
    setSuccessNotice(null);

    if (isSuspending) {
      const res = await suspendInstitution(inst._id);
      if (res.success) {
        setSuccessNotice(`Institution "${inst.name}" suspended successfully.`);
        loadInstitutions();
      } else if (res.error) {
        setError(`${res.error.code}: ${res.error.message}`);
      }
    } else {
      const res = await reactivateInstitution(inst._id);
      if (res.success) {
        setSuccessNotice(`Institution "${inst.name}" reactivated successfully.`);
        loadInstitutions();
      } else if (res.error) {
        setError(`${res.error.code}: ${res.error.message}`);
      }
    }
  };

  const handleResendCollegeAdminInvite = async (inst: InstitutionDto) => {
    setError(null);
    setSuccessNotice(null);
    try {
      const res = await resendInstitutionAdminInvitation(inst._id);
      if (res.success && res.data) {
        const delivery = res.data.emailDelivery;
        const deliveryStatus = delivery?.delivered
          ? 'Activation email dispatched via SMTP.'
          : `Email delivery offline (SMTP unconfigured/skipped). Account remains in pending activation.`;
        setSuccessNotice(`College Admin invitation refreshed for ${inst.adminEmail}. ${deliveryStatus}`);
        loadInstitutions();
      } else {
        setError(res.error?.message || 'Failed to resend College Admin invitation.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error sending request';
      setError(`Failed to resend invitation: ${msg}`);
    }
  };

  const handleOpenPermanentDelete = (inst: InstitutionDto) => {
    setDeletingInst(inst);
    setConfirmDeleteName('');
    setDeleteDependencyError(null);
    setIsDeleteModalOpen(true);
  };

  const handlePermanentDeleteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletingInst) return;

    if (confirmDeleteName.trim().toLowerCase() !== deletingInst.name.trim().toLowerCase()) {
      setDeleteDependencyError('Confirmation name does not match the institution name exactly.');
      return;
    }

    setSubmitting(true);
    setDeleteDependencyError(null);

    const res = await deleteInstitutionPermanently(deletingInst._id);
    setSubmitting(false);

    if (res.success) {
      setIsDeleteModalOpen(false);
      setSuccessNotice(`Institution "${deletingInst.name}" and its residual configuration have been permanently deleted.`);
      setDeletingInst(null);
      loadInstitutions();
    } else if (res.error) {
      if (res.error.code === 'DEPENDENT_RESOURCES_EXIST' && res.error.details) {
        const d = res.error.details as any;
        const parts = [];
        if (d.departments) parts.push(`${d.departments} department(s)`);
        if (d.courses) parts.push(`${d.courses} course(s)`);
        if (d.subjects) parts.push(`${d.subjects} subject(s)`);
        if (d.laboratories) parts.push(`${d.laboratories} lab(s)`);
        if (d.experiments) parts.push(`${d.experiments} experiment(s)`);
        if (d.faculty) parts.push(`${d.faculty} faculty account(s)`);
        if (d.students) parts.push(`${d.students} student account(s)`);
        setDeleteDependencyError(
          `Cannot permanently delete: ${res.error.message} Existing dependent records: ${parts.join(', ')}. Please delete or archive child records first.`
        );
      } else {
        setDeleteDependencyError(`${res.error.code}: ${res.error.message}`);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Institution Directory &amp; Governance
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Manage colleges and universities registered on the platform with Edit, Suspend/Reactivate, and Delete controls.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            variant="outline"
            icon={<RefreshCw size={16} />}
            onClick={() => loadInstitutions()}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            variant="primary"
            icon={<Plus size={16} />}
            onClick={() => setIsModalOpen(true)}
          >
            Onboard New Institution
          </Button>
        </div>
      </div>

      {/* Notifications */}
      {error && (
        <Alert type="danger" title="Operation Error">
          {error}
        </Alert>
      )}

      {successNotice && (
        <Alert type="success" title="Success">
          {successNotice}
        </Alert>
      )}

      {/* Filter Toolbar */}
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
            placeholder="Search by college name, domain, or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>Status:</span>
          <select
            className="form-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="pending_activation">Pending Activation</option>
            <option value="suspended">Suspended</option>
          </select>
        </div>
      </div>

      {/* Institutions Content */}
      <Card padding={false}>
        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 12px' }} />
            <p>Loading tenant institutions from persistent storage...</p>
          </div>
        ) : institutions.length === 0 ? (
          <div style={{ padding: '30px 20px' }}>
            <EmptyState
              title="No Institutions Found"
              description="No tenant institutions match your current search filters or backend database is empty."
              actionLabel="Onboard First College"
              onAction={() => setIsModalOpen(true)}
            />
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>College / Institution</th>
                  <th>Tenant Code</th>
                  <th>Authorized Domain</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {institutions.map((inst) => (
                  <tr key={inst._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 'var(--radius-sm)',
                            background: 'rgba(99, 102, 241, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'var(--text-accent)',
                          }}
                        >
                          <Building2 size={16} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600 }}>{inst.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Admin: {inst.adminEmail}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td><code>{inst.code}</code></td>
                    <td><code>{inst.domain}</code></td>
                    <td>{formatInstitutionType(inst.type, inst.otherInstitutionType)}</td>
                    <td>
                      {inst.status === 'active' && <Badge variant="success" dot>Active</Badge>}
                      {inst.status === 'pending_activation' && <Badge variant="warning" dot>Pending</Badge>}
                      {inst.status === 'suspended' && <Badge variant="danger" dot>Suspended</Badge>}
                      {inst.status === 'trial' && <Badge variant="neutral" dot>Trial</Badge>}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Button
                          variant="outline"
                          size="sm"
                          icon={<Edit2 size={14} />}
                          onClick={() => handleOpenEdit(inst)}
                        >
                          Edit
                        </Button>
                        {inst.status === 'pending_activation' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Send size={14} />}
                            onClick={() => handleResendCollegeAdminInvite(inst)}
                            title="Resend activation invitation email to College Admin"
                          >
                            Resend Invite
                          </Button>
                        )}
                        <Button
                          variant={inst.status === 'suspended' ? 'outline' : 'danger'}
                          size="sm"
                          icon={inst.status === 'suspended' ? <CheckCircle2 size={14} /> : <ShieldAlert size={14} />}
                          onClick={() => handleToggleSuspend(inst)}
                        >
                          {inst.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                        </Button>
                        {inst.status === 'suspended' && (
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<Trash2 size={14} />}
                            onClick={() => handleOpenPermanentDelete(inst)}
                            title="Permanently delete suspended institution"
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={1}
          totalItems={institutions.length}
          itemsPerPage={10}
          onPageChange={setCurrentPage}
        />
      </Card>

      {/* Onboarding Modal Dialog */}
      <ModalDialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Onboard New Institution Tenant"
        description="Establish an isolated institutional workspace with dedicated database tenancy and academic structure."
      >
        <form onSubmit={handleOnboardSubmit}>
          <FormField label="Full Institution Name" required helperText="e.g. Apex Institute of Technology">
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. Apex Institute of Technology"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </FormField>

          <div className="grid-2">
            <FormField label="Tenant Code" required helperText="Short uppercase prefix (e.g. APEX)">
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. APEX"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              />
            </FormField>

            <FormField label="Authorized Email Domain" required helperText="e.g. apex.edu">
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. apex.edu"
                value={formData.domain}
                onChange={(e) => setFormData({ ...formData, domain: e.target.value.toLowerCase() })}
              />
            </FormField>
          </div>

          <div className="grid-2">
            <FormField label="Institution Type" required helperText="Select category from recognized institutions">
              <select
                className="form-select"
                value={formData.type}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    type: e.target.value,
                    otherInstitutionType:
                      e.target.value === 'other' || e.target.value === 'other_institution_type'
                        ? formData.otherInstitutionType
                        : '',
                  })
                }
              >
                {INSTITUTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Tenant Admin Email" required helperText="Initial College Admin account email">
              <input
                type="email"
                required
                className="form-input"
                placeholder="admin@apex.edu"
                value={formData.adminEmail}
                onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
              />
            </FormField>
          </div>

          {(formData.type === 'other' || formData.type === 'other_institution_type') && (
            <FormField
              label="Specify Custom Institution Type"
              required
              helperText="Enter the official institution classification or title"
            >
              <input
                type="text"
                required
                className="form-input"
                placeholder="e.g. Maritime Academy / Defense Training Institute"
                value={formData.otherInstitutionType}
                onChange={(e) => setFormData({ ...formData, otherInstitutionType: e.target.value })}
                maxLength={100}
              />
            </FormField>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Provisioning...' : 'Complete Onboarding'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Edit Institution Modal Dialog */}
      <ModalDialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit Institution: ${editingInst?.name || ''}`}
        description="Update institution profile, category, administrator email, or operational status."
      >
        <form onSubmit={handleEditSubmit}>
          <FormField label="Institution Name" required>
            <input
              type="text"
              required
              className="form-input"
              value={editFormData.name}
              onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            />
          </FormField>

          <div className="grid-2">
            <FormField label="Tenant Code" required helperText="Unique tenant code prefix">
              <input
                type="text"
                required
                className="form-input"
                value={editFormData.code}
                onChange={(e) => setEditFormData({ ...editFormData, code: e.target.value.toUpperCase() })}
              />
            </FormField>

            <FormField label="Authorized Email Domain" required helperText="Domain for user self-registration">
              <input
                type="text"
                required
                className="form-input"
                value={editFormData.domain}
                onChange={(e) => setEditFormData({ ...editFormData, domain: e.target.value.toLowerCase() })}
              />
            </FormField>
          </div>

          <FormField
            label="College Admin Email"
            required
            helperText="Changing this address will invalidate pending invitations and send a fresh activation link to the new address."
          >
            <input
              type="email"
              required
              className="form-input"
              value={editFormData.adminEmail}
              onChange={(e) => setEditFormData({ ...editFormData, adminEmail: e.target.value })}
            />
          </FormField>

          <div className="grid-2">
            <FormField label="Institution Type" required>
              <select
                className="form-select"
                value={editFormData.type}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    type: e.target.value,
                    otherInstitutionType:
                      e.target.value === 'other' || e.target.value === 'other_institution_type'
                        ? editFormData.otherInstitutionType
                        : '',
                  })
                }
              >
                {INSTITUTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Status" required>
              <select
                className="form-select"
                value={editFormData.status}
                onChange={(e) =>
                  setEditFormData({
                    ...editFormData,
                    status: e.target.value as 'active' | 'pending_activation' | 'suspended',
                  })
                }
              >
                <option value="active">Active</option>
                <option value="pending_activation">Pending Activation</option>
                <option value="suspended">Suspended</option>
              </select>
            </FormField>
          </div>

          {(editFormData.type === 'other' || editFormData.type === 'other_institution_type') && (
            <FormField label="Specify Custom Institution Type" required>
              <input
                type="text"
                required
                className="form-input"
                value={editFormData.otherInstitutionType}
                onChange={(e) => setEditFormData({ ...editFormData, otherInstitutionType: e.target.value })}
                maxLength={100}
              />
            </FormField>
          )}

          <FormField label="Contact Phone" helperText="Administrative phone number (optional)">
            <input
              type="tel"
              className="form-input"
              placeholder="+91 98765 43210"
              value={editFormData.contactPhone}
              onChange={(e) => setEditFormData({ ...editFormData, contactPhone: e.target.value })}
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Permanent Delete Confirmation Dialog */}
      <ModalDialog
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={`Permanently Delete Institution: ${deletingInst?.name || ''}`}
        description="This action is irreversible and completely removes this institution and its baseline tenant configuration."
      >
        <form onSubmit={handlePermanentDeleteSubmit}>
          <div style={{ padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(239, 68, 68, 0.25)', marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <AlertTriangle size={20} style={{ color: 'var(--danger-color)', flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                <strong>Strict Dependency Guard:</strong> Permanent deletion is only permitted for institutions that have zero dependent departments, courses, laboratories, experiments, or enrolled users.
              </div>
            </div>
          </div>

          {deleteDependencyError && (
            <div style={{ marginBottom: 16 }}>
              <Alert type="danger" title="Cannot Delete Institution">
                {deleteDependencyError}
              </Alert>
            </div>
          )}

          <FormField
            label={`To confirm permanent deletion, type "${deletingInst?.name || ''}" below:`}
            required
            helperText="Case-insensitive verification check"
          >
            <input
              type="text"
              required
              className="form-input"
              placeholder={deletingInst?.name}
              value={confirmDeleteName}
              onChange={(e) => setConfirmDeleteName(e.target.value)}
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button
              variant="outline"
              type="button"
              onClick={() => {
                setIsDeleteModalOpen(false);
                setDeletingInst(null);
                setDeleteDependencyError(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              type="submit"
              disabled={submitting || confirmDeleteName.trim().toLowerCase() !== (deletingInst?.name || '').trim().toLowerCase()}
            >
              {submitting ? 'Verifying & Deleting...' : 'Permanently Delete'}
            </Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
