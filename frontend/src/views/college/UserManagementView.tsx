import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Search, AlertCircle, RefreshCw, Edit2, Send, ShieldAlert, CheckCircle2, Trash2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';
import { ModalDialog } from '../../components/common/ModalDialog';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/common/Alert';
import { EmptyState } from '../../components/common/EmptyState';
import {
  getUsers,
  createUser,
  inviteUser,
  updateUser,
  deleteUser,
  deleteUserPermanently,
  resendUserInvitation,
  getDepartments,
  getCourses,
  UserDto,
  DepartmentDto,
  CourseDto,
} from '../../services/api';

export const UserManagementView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Async state
  const [users, setUsers] = useState<UserDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Form State (New)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    departmentId: '',
    courseId: '',
  });

  // Edit State
  const [selectedUser, setSelectedUser] = useState<UserDto | null>(null);
  const [editForm, setEditForm] = useState({
    name: '',
    role: 'student',
    departmentId: '',
    courseId: '',
    status: 'active' as 'active' | 'inactive' | 'suspended' | 'pending_activation',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [userRes, deptRes, courseRes] = await Promise.all([
        getUsers({ role: roleFilter, search: searchTerm }),
        getDepartments(),
        getCourses(),
      ]);

      if (userRes.success && userRes.data) {
        setUsers(userRes.data);
      } else if (userRes.error) {
        setError(`${userRes.error.code}: ${userRes.error.message}`);
      }

      if (deptRes.success && deptRes.data) {
        setDepartments(deptRes.data);
      }

      if (courseRes.success && courseRes.data) {
        setCourses(courseRes.data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query users';
      setError(`NETWORK_ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [roleFilter, searchTerm]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUserDeptChange = (deptId: string) => {
    setUserForm((prev) => ({
      ...prev,
      departmentId: deptId,
      courseId: '', // Reset previously selected course
    }));
  };

  const handleEditDeptChange = (deptId: string) => {
    setEditForm((prev) => ({
      ...prev,
      departmentId: deptId,
      courseId: '', // Reset previously selected course
    }));
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessNotice(null);

    if (userForm.role === 'faculty') {
      if (!userForm.departmentId) {
        setSubmitting(false);
        setError('Assigned Department is required for Faculty members.');
        return;
      }
      if (!userForm.courseId) {
        setSubmitting(false);
        setError('Assigned Course is required for Faculty members.');
        return;
      }
    }

    const hasExplicitPassword = !!userForm.password && userForm.password.trim().length > 0;
    const payload = {
      name: userForm.name.trim(),
      email: userForm.email.trim().toLowerCase(),
      role: userForm.role,
      departmentId: userForm.departmentId || undefined,
      courseId: userForm.courseId || undefined,
    };

    const res = hasExplicitPassword
      ? await createUser({
          ...payload,
          password: userForm.password.trim(),
        })
      : await inviteUser(payload);

    setSubmitting(false);

    if (res.success && res.data) {
      setIsModalOpen(false);
      const isInvite = !hasExplicitPassword;
      const delivery = (res.data as any)?.emailDelivery;
      let deliveryMsg = '';
      if (delivery) {
        if (delivery.delivered) {
          deliveryMsg = ` Activation email dispatched to ${userForm.email}.`;
        } else {
          deliveryMsg = ` (Email delivery ${delivery.reason === 'EMAIL_SERVICE_UNCONFIGURED' ? 'skipped: SMTP unconfigured' : 'failed'}. Account is pending activation.)`;
        }
      }
      setSuccessNotice(
        isInvite
          ? `Invitation issued for "${userForm.name}" (${userForm.email}).${deliveryMsg}`
          : `User account "${userForm.name}" (${userForm.email}) provisioned successfully.`
      );
      setUserForm({
        name: '',
        email: '',
        password: '',
        role: 'student',
        departmentId: '',
        courseId: '',
      });
      loadData();
    } else {
      setError(res.error?.message || 'Failed to provision user.');
    }
  };

  const handleOpenEdit = (user: UserDto) => {
    setSelectedUser(user);
    const deptId =
      typeof user.departmentId === 'object' && user.departmentId !== null
        ? user.departmentId._id
        : user.departmentId || '';
    const crsId =
      typeof user.courseId === 'object' && user.courseId !== null
        ? user.courseId._id
        : user.courseId || '';

    setEditForm({
      name: user.name,
      role: user.role,
      departmentId: deptId,
      courseId: crsId,
      status: user.status,
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (editForm.role === 'faculty') {
      if (!editForm.departmentId) {
        setError('Assigned Department is required for Faculty members.');
        return;
      }
      if (!editForm.courseId) {
        setError('Assigned Course is required for Faculty members.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    setSuccessNotice(null);

    const res = await updateUser(selectedUser._id, {
      name: editForm.name.trim(),
      role: editForm.role as any,
      departmentId: editForm.departmentId || undefined,
      courseId: editForm.courseId || undefined,
      status: editForm.status,
    });

    setSubmitting(false);

    if (res.success && res.data) {
      setIsEditModalOpen(false);
      setSuccessNotice(`User "${res.data.name}" updated successfully.`);
      loadData();
    } else {
      setError(res.error?.message || 'Failed to update user.');
    }
  };

  const handleResendInvite = async (user: UserDto) => {
    setError(null);
    setSuccessNotice(null);

    const res = await resendUserInvitation(user._id);
    if (res.success && res.data) {
      const emailDelivery = res.data.emailDelivery;
      const emailStatus = emailDelivery?.delivered
        ? 'Activation email sent via SMTP.'
        : `Email delivery ${emailDelivery?.reason === 'EMAIL_SERVICE_UNCONFIGURED' ? 'skipped (SMTP unconfigured)' : 'failed'}. Account remains in pending activation.`;
      setSuccessNotice(`Invitation refreshed for ${user.email}. ${emailStatus}`);
      loadData();
    } else {
      setError(res.error?.message || 'Failed to resend invitation.');
    }
  };

  const handleToggleSuspend = async (user: UserDto) => {
    const isSuspending = user.status !== 'suspended';
    const confirmMsg = isSuspending
      ? `Suspend account for "${user.name}"? They will not be able to log in.`
      : `Reactivate account for "${user.name}"?`;

    if (!window.confirm(confirmMsg)) return;

    setError(null);
    setSuccessNotice(null);

    if (isSuspending) {
      const res = await deleteUser(user._id);
      if (res.success) {
        setSuccessNotice(`User "${user.name}" has been suspended.`);
        loadData();
      } else {
        setError(res.error?.message || 'Failed to suspend user.');
      }
    } else {
      const res = await updateUser(user._id, { status: 'active' });
      if (res.success) {
        setSuccessNotice(`User "${user.name}" reactivated.`);
        loadData();
      } else {
        setError(res.error?.message || 'Failed to reactivate user.');
      }
    }
  };

  const handlePermanentDeleteUser = async (user: UserDto) => {
    if (
      !window.confirm(
        `Permanently delete account for "${user.name}" (${user.email})? This action is irreversible and requires zero historical academic records or curriculum leadership associations.`
      )
    ) {
      return;
    }
    setError(null);
    setSuccessNotice(null);
    const res = await deleteUserPermanently(user._id);
    if (res.success) {
      setSuccessNotice(`User "${user.name}" has been permanently deleted.`);
      loadData();
    } else {
      setError(res.error?.message || 'Failed to permanently delete user.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            College Identity &amp; User Governance
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Onboard, invite, and govern faculty and student accounts with department and course-level assignment.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={loadData} disabled={loading}>
            Refresh
          </Button>
          <Button variant="primary" icon={<UserPlus size={16} />} onClick={() => setIsModalOpen(true)}>
            Onboard User / Send Invite
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <Alert type="danger" onClose={() => setError(null)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        </Alert>
      )}

      {successNotice && (
        <Alert type="success" onClose={() => setSuccessNotice(null)}>
          {successNotice}
        </Alert>
      )}

      {/* Filter toolbar */}
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
            placeholder="Search by full name or institutional email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <select
            className="form-select"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            style={{ width: 'auto' }}
          >
            <option value="all">All Roles</option>
            <option value="faculty">Faculty Members</option>
            <option value="student">Students</option>
            <option value="college-admin">College Administrators</option>
          </select>
        </div>
      </div>

      {/* User Table (Columns: Name & Email | Role | Department | Assigned Course | Status | Actions) */}
      <Card padding={false}>
        {loading ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
            <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 12px' }} />
            <p>Loading users from database...</p>
          </div>
        ) : users.length === 0 ? (
          <div style={{ padding: '30px 20px' }}>
            <EmptyState
              title="No Users Registered"
              description="No user records match your search criteria."
              actionLabel="Provision User"
              onAction={() => setIsModalOpen(true)}
            />
          </div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name &amp; Email</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Assigned Course</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const deptName =
                    typeof u.departmentId === 'object' && u.departmentId !== null
                      ? u.departmentId.name
                      : departments.find((d) => d._id === u.departmentId)?.name || 'Unassigned';

                  const courseObj =
                    typeof u.courseId === 'object' && u.courseId !== null
                      ? u.courseId
                      : courses.find((c) => c._id === u.courseId);

                  const courseDisplay = courseObj ? `${courseObj.name} (${courseObj.code})` : null;

                  return (
                    <tr key={u._id}>
                      <td>
                        <div>
                          <div style={{ fontWeight: 600 }}>{u.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                        </div>
                      </td>
                      <td>
                        <Badge variant={u.role === 'student' ? 'info' : u.role === 'faculty' ? 'brand' : 'neutral'}>
                          {u.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td><strong>{deptName}</strong></td>
                      <td>
                        {courseDisplay ? (
                          <span>{courseDisplay}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Not Assigned</span>
                        )}
                      </td>
                      <td>
                        {u.status === 'active' && <Badge variant="success" dot>Active</Badge>}
                        {u.status === 'pending_activation' && <Badge variant="warning" dot>Pending Activation</Badge>}
                        {u.status === 'inactive' && <Badge variant="neutral" dot>Inactive</Badge>}
                        {u.status === 'suspended' && <Badge variant="danger" dot>Suspended</Badge>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<Edit2 size={13} />}
                            onClick={() => handleOpenEdit(u)}
                          >
                            Edit
                          </Button>
                          {u.status === 'pending_activation' && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Send size={13} />}
                              onClick={() => handleResendInvite(u)}
                            >
                              Resend Invite
                            </Button>
                          )}
                          <Button
                            variant={u.status === 'suspended' ? 'outline' : 'ghost'}
                            size="sm"
                            icon={u.status === 'suspended' ? <CheckCircle2 size={13} /> : <ShieldAlert size={13} />}
                            onClick={() => handleToggleSuspend(u)}
                          >
                            {u.status === 'suspended' ? 'Reactivate' : 'Suspend'}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<Trash2 size={13} />}
                            onClick={() => handlePermanentDeleteUser(u)}
                            title="Permanently delete user account"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination
          currentPage={currentPage}
          totalPages={1}
          totalItems={users.length}
          itemsPerPage={10}
          onPageChange={setCurrentPage}
        />
      </Card>

      {/* Onboard / Invite User Modal Dialog */}
      <ModalDialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Provision or Invite College Member"
        description="Issue an expiring single-use invitation link or provision with an explicit password."
      >
        <form onSubmit={handleCreateUser}>
          <FormField label="Full Name" required>
            <input
              type="text"
              required
              className="form-input"
              placeholder="e.g. Dr. Ramesh Kumar / Ananya Sen"
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
            />
          </FormField>

          <FormField label="College Email Address" required>
            <input
              type="email"
              required
              className="form-input"
              placeholder="user@college.edu"
              value={userForm.email}
              onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
            />
          </FormField>

          <div className="grid-2">
            <FormField label="Institutional Role" required>
              <select
                className="form-select"
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty Member</option>
                <option value="college-admin">College Administrator</option>
              </select>
            </FormField>

            <FormField
              label={userForm.role === 'faculty' ? 'Assigned Department' : 'Assigned Department (Optional)'}
              required={userForm.role === 'faculty'}
            >
              <select
                className="form-select"
                value={userForm.departmentId}
                onChange={(e) => handleUserDeptChange(e.target.value)}
                required={userForm.role === 'faculty'}
              >
                <option value="">{userForm.role === 'faculty' ? '-- Select Department --' : 'None / General'}</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {/* Assigned Course Dropdown - Cascading under Department */}
          <FormField
            label={userForm.role === 'faculty' ? 'Assigned Course' : 'Assigned Course (Optional)'}
            required={userForm.role === 'faculty'}
            helperText={
              userForm.role === 'faculty'
                ? 'Primary course/programme assigned to this faculty member.'
                : 'Primary degree programme for student enrollment.'
            }
          >
            <select
              className="form-select"
              value={userForm.courseId}
              onChange={(e) => setUserForm({ ...userForm, courseId: e.target.value })}
              disabled={!userForm.departmentId}
              required={userForm.role === 'faculty'}
            >
              {!userForm.departmentId ? (
                <option value="">Select an Assigned Department first</option>
              ) : (
                <>
                  <option value="">
                    {userForm.role === 'faculty' ? '-- Select Course --' : 'None / Unassigned'}
                  </option>
                  {courses
                    .filter((c) => {
                      const dId =
                        typeof c.departmentId === 'object' && c.departmentId !== null
                          ? c.departmentId._id
                          : c.departmentId;
                      return dId === userForm.departmentId;
                    })
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.code}) - {c.degreeLevel.toUpperCase()}
                      </option>
                    ))}
                </>
              )}
            </select>
          </FormField>

          <FormField
            label="Initial Password (Optional)"
            helperText="Leave empty to send a secure single-use invitation link (recommended)"
          >
            <input
              type="password"
              className="form-input"
              placeholder="Min 8 chars with uppercase, number & symbol"
              value={userForm.password}
              onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
            />
          </FormField>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button variant="outline" type="button" onClick={() => setIsModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting
                ? 'Processing...'
                : userForm.password
                ? 'Provision Account'
                : 'Send Invitation Link'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Edit User Modal Dialog */}
      <ModalDialog
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title={`Edit User: ${selectedUser?.name || ''}`}
        description="Update account profile, institutional role, assigned department, course, or access status."
      >
        <form onSubmit={handleEditSubmit}>
          <FormField label="Full Name" required>
            <input
              type="text"
              required
              className="form-input"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </FormField>

          <div className="grid-2">
            <FormField label="Institutional Role" required>
              <select
                className="form-select"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
              >
                <option value="student">Student</option>
                <option value="faculty">Faculty Member</option>
                <option value="college-admin">College Administrator</option>
              </select>
            </FormField>

            <FormField label="Status" required>
              <select
                className="form-select"
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({
                    ...editForm,
                    status: e.target.value as 'active' | 'inactive' | 'suspended' | 'pending_activation',
                  })
                }
              >
                <option value="active">Active</option>
                <option value="pending_activation">Pending Activation</option>
                <option value="inactive">Inactive</option>
                <option value="suspended">Suspended</option>
              </select>
            </FormField>
          </div>

          <div className="grid-2">
            <FormField
              label={editForm.role === 'faculty' ? 'Assigned Department' : 'Assigned Department (Optional)'}
              required={editForm.role === 'faculty'}
            >
              <select
                className="form-select"
                value={editForm.departmentId}
                onChange={(e) => handleEditDeptChange(e.target.value)}
                required={editForm.role === 'faculty'}
              >
                <option value="">{editForm.role === 'faculty' ? '-- Select Department --' : 'None / General'}</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField
              label={editForm.role === 'faculty' ? 'Assigned Course' : 'Assigned Course (Optional)'}
              required={editForm.role === 'faculty'}
            >
              <select
                className="form-select"
                value={editForm.courseId}
                onChange={(e) => setEditForm({ ...editForm, courseId: e.target.value })}
                disabled={!editForm.departmentId}
                required={editForm.role === 'faculty'}
              >
                {!editForm.departmentId ? (
                  <option value="">Select an Assigned Department first</option>
                ) : (
                  <>
                    <option value="">
                      {editForm.role === 'faculty' ? '-- Select Course --' : 'None / Unassigned'}
                    </option>
                    {courses
                      .filter((c) => {
                        const dId =
                          typeof c.departmentId === 'object' && c.departmentId !== null
                            ? c.departmentId._id
                            : c.departmentId;
                        return dId === editForm.departmentId;
                      })
                      .map((c) => (
                        <option key={c._id} value={c._id}>
                          {c.name} ({c.code}) - {c.degreeLevel.toUpperCase()}
                        </option>
                      ))}
                  </>
                )}
              </select>
            </FormField>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button variant="outline" type="button" onClick={() => setIsEditModalOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save User'}
            </Button>
          </div>
        </form>
      </ModalDialog>
    </div>
  );
};
