import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ChevronRight, AlertCircle, RefreshCw, Edit2, Trash2, CheckCircle2, ShieldAlert } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Tabs } from '../../components/common/Tabs';
import { ModalDialog } from '../../components/common/ModalDialog';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/common/Alert';
import { EmptyState } from '../../components/common/EmptyState';
import {
  getDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  deleteDepartmentPermanently,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  deleteCoursePermanently,
  getLaboratories,
  createLaboratory,
  updateLaboratory,
  deleteLaboratory,
  deleteLaboratoryPermanently,
  DepartmentDto,
  CourseDto,
  LaboratoryDto,
} from '../../services/api';

interface DependencyErrorInfo {
  title: string;
  item: string;
  message: string;
  dependencies?: Record<string, number>;
}

export const AcademicHierarchyView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('departments');

  // Modals
  const [modalType, setModalType] = useState<
    'add-dept' | 'edit-dept' | 'add-course' | 'edit-course' | 'add-lab' | 'edit-lab' | null
  >(null);

  // Dependency error modal
  const [dependencyError, setDependencyError] = useState<DependencyErrorInfo | null>(null);

  // Async data states
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);

  // Selected item for edit
  const [selectedDept, setSelectedDept] = useState<DepartmentDto | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<CourseDto | null>(null);
  const [selectedLab, setSelectedLab] = useState<LaboratoryDto | null>(null);

  // Form states
  const [deptForm, setDeptForm] = useState({ name: '', code: '', headOfDept: '' });
  const [courseForm, setCourseForm] = useState({
    departmentId: '',
    name: '',
    code: '',
    degreeLevel: 'undergraduate',
    totalSemesters: 8,
  });
  const [labForm, setLabForm] = useState({
    departmentId: '',
    courseId: '',
    name: '',
    code: '',
    location: '',
    capacity: 30,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [deptRes, courseRes, labRes] = await Promise.all([
        getDepartments(),
        getCourses(),
        getLaboratories(),
      ]);

      if (deptRes.success && deptRes.data) setDepartments(deptRes.data);
      if (courseRes.success && courseRes.data) setCourses(courseRes.data);
      if (labRes.success && labRes.data) setLaboratories(labRes.data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(`NETWORK_ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Keep labForm course dropdown filtered when departmentId changes
  const handleLabDepartmentChange = (deptId: string) => {
    const matchingCourses = courses.filter((c) => {
      const dId = typeof c.departmentId === 'object' && c.departmentId !== null ? c.departmentId._id : c.departmentId;
      return dId === deptId;
    });
    setLabForm({
      ...labForm,
      departmentId: deptId,
      courseId: matchingCourses[0]?._id || '',
    });
  };

  /* ================= DEPARTMENT HANDLERS ================= */
  const handleSaveDept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (modalType === 'add-dept') {
      const res = await createDepartment({
        name: deptForm.name.trim(),
        code: deptForm.code.trim().toUpperCase(),
        headOfDepartment: deptForm.headOfDept.trim(),
      });
      setSubmitting(false);
      if (res.success && res.data) {
        setModalType(null);
        setSuccessNotice(`Department "${res.data.name}" created successfully.`);
        loadData();
      } else {
        setError(res.error?.message || 'Failed to create department.');
      }
    } else if (modalType === 'edit-dept' && selectedDept) {
      const res = await updateDepartment(selectedDept._id, {
        name: deptForm.name.trim(),
        headOfDepartment: deptForm.headOfDept.trim(),
      });
      setSubmitting(false);
      if (res.success && res.data) {
        setModalType(null);
        setSuccessNotice(`Department "${res.data.name}" updated successfully.`);
        loadData();
      } else {
        setError(res.error?.message || 'Failed to update department.');
      }
    }
  };

  const handleArchiveDept = async (dept: DepartmentDto) => {
    if (!window.confirm(`Archive department "${dept.name}" (${dept.code})? It will be marked inactive but its historical records remain preserved.`)) return;
    setError(null);
    const res = await deleteDepartment(dept._id);
    if (res.success) {
      setSuccessNotice(`Department "${dept.name}" archived.`);
      loadData();
    } else {
      if (res.error?.code === 'DEPENDENT_RESOURCES_EXIST') {
        const details = res.error.details as { activeDependencies?: Record<string, number> } | undefined;
        setDependencyError({
          title: 'Cannot Archive Department',
          item: `${dept.name} (${dept.code})`,
          message: res.error.message || 'All child courses under this department must be archived first.',
          dependencies: details?.activeDependencies,
        });
      } else {
        setError(res.error?.message || 'Failed to archive department.');
      }
    }
  };

  const handleReactivateDept = async (dept: DepartmentDto) => {
    setError(null);
    const res = await updateDepartment(dept._id, { status: 'active' });
    if (res.success) {
      setSuccessNotice(`Department "${dept.name}" reactivated.`);
      loadData();
    } else {
      setError(res.error?.message || 'Failed to reactivate department.');
    }
  };

  const handlePermanentDeleteDept = async (dept: DepartmentDto) => {
    if (
      !window.confirm(
        `PERMANENT DELETE: Are you sure you want to permanently remove department "${dept.name}" (${dept.code}) from database?\n\nThis action is irreversible. The department must have zero child courses or associated user accounts.`
      )
    ) {
      return;
    }
    setError(null);
    const res = await deleteDepartmentPermanently(dept._id);
    if (res.success) {
      setSuccessNotice(`Department "${dept.name}" permanently deleted.`);
      loadData();
    } else {
      if (res.error?.code === 'DEPENDENT_RESOURCES_EXIST') {
        const details = res.error.details as { dependencies?: Record<string, number> } | undefined;
        setDependencyError({
          title: 'Permanent Deletion Blocked: Dependencies Exist',
          item: `${dept.name} (${dept.code})`,
          message: res.error.message || 'This department cannot be deleted because dependent courses, subjects, or user accounts still exist.',
          dependencies: details?.dependencies,
        });
      } else {
        setError(res.error?.message || 'Failed to permanently delete department.');
      }
    }
  };

  /* ================= COURSE HANDLERS ================= */
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (modalType === 'add-course') {
      const res = await createCourse({
        departmentId: courseForm.departmentId,
        name: courseForm.name.trim(),
        code: courseForm.code.trim().toUpperCase(),
        degreeLevel: courseForm.degreeLevel,
        totalSemesters: Number(courseForm.totalSemesters),
      });
      setSubmitting(false);
      if (res.success && res.data) {
        setModalType(null);
        setSuccessNotice(`Course "${res.data.name}" added successfully.`);
        loadData();
      } else {
        setError(res.error?.message || 'Failed to add course.');
      }
    } else if (modalType === 'edit-course' && selectedCourse) {
      const res = await updateCourse(selectedCourse._id, {
        name: courseForm.name.trim(),
        degreeLevel: courseForm.degreeLevel,
        totalSemesters: Number(courseForm.totalSemesters),
      });
      setSubmitting(false);
      if (res.success && res.data) {
        setModalType(null);
        setSuccessNotice(`Course "${res.data.name}" updated successfully.`);
        loadData();
      } else {
        setError(res.error?.message || 'Failed to update course.');
      }
    }
  };

  const handleArchiveCourse = async (course: CourseDto) => {
    if (!window.confirm(`Archive course "${course.name}"? It will be marked inactive but its historical records remain preserved.`)) return;
    setError(null);
    const res = await deleteCourse(course._id);
    if (res.success) {
      setSuccessNotice(`Course "${course.name}" archived.`);
      loadData();
    } else {
      if (res.error?.code === 'DEPENDENT_RESOURCES_EXIST') {
        const details = res.error.details as { activeDependencies?: Record<string, number> } | undefined;
        setDependencyError({
          title: 'Cannot Archive Course',
          item: `${course.name} (${course.code})`,
          message: res.error.message || 'All child laboratories under this course must be archived first.',
          dependencies: details?.activeDependencies,
        });
      } else {
        setError(res.error?.message || 'Failed to archive course.');
      }
    }
  };

  const handleReactivateCourse = async (course: CourseDto) => {
    setError(null);
    const res = await updateCourse(course._id, { status: 'active' });
    if (res.success) {
      setSuccessNotice(`Course "${course.name}" reactivated.`);
      loadData();
    } else {
      setError(res.error?.message || 'Failed to reactivate course.');
    }
  };

  const handlePermanentDeleteCourse = async (course: CourseDto) => {
    if (
      !window.confirm(
        `PERMANENT DELETE: Are you sure you want to permanently delete course "${course.name}" (${course.code})?\n\nThis action is irreversible. The course must have zero child laboratories or experiments.`
      )
    ) {
      return;
    }
    setError(null);
    const res = await deleteCoursePermanently(course._id);
    if (res.success) {
      setSuccessNotice(`Course "${course.name}" permanently deleted.`);
      loadData();
    } else {
      if (res.error?.code === 'DEPENDENT_RESOURCES_EXIST') {
        const details = res.error.details as { dependencies?: Record<string, number> } | undefined;
        setDependencyError({
          title: 'Permanent Deletion Blocked: Dependencies Exist',
          item: `${course.name} (${course.code})`,
          message: res.error.message || 'This course cannot be deleted because dependent laboratories or curriculum items still reference it.',
          dependencies: details?.dependencies,
        });
      } else {
        setError(res.error?.message || 'Failed to permanently delete course.');
      }
    }
  };

  /* ================= LABORATORY HANDLERS ================= */
  const handleSaveLab = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    if (modalType === 'add-lab') {
      const res = await createLaboratory({
        departmentId: labForm.departmentId,
        courseId: labForm.courseId,
        name: labForm.name.trim(),
        code: labForm.code.trim().toUpperCase(),
        location: labForm.location.trim() || undefined,
        capacity: Number(labForm.capacity) || 30,
      });
      setSubmitting(false);
      if (res.success && res.data) {
        setModalType(null);
        setSuccessNotice(`Laboratory "${res.data.name}" created successfully.`);
        loadData();
      } else {
        setError(res.error?.message || 'Failed to create laboratory.');
      }
    } else if (modalType === 'edit-lab' && selectedLab) {
      const res = await updateLaboratory(selectedLab._id, {
        name: labForm.name.trim(),
        location: labForm.location.trim() || undefined,
        capacity: Number(labForm.capacity),
      });
      setSubmitting(false);
      if (res.success && res.data) {
        setModalType(null);
        setSuccessNotice(`Laboratory "${res.data.name}" updated successfully.`);
        loadData();
      } else {
        setError(res.error?.message || 'Failed to update laboratory.');
      }
    }
  };

  const handleArchiveLab = async (lab: LaboratoryDto) => {
    if (!window.confirm(`Archive laboratory "${lab.name}"? It will be marked inactive.`)) return;
    setError(null);
    const res = await deleteLaboratory(lab._id);
    if (res.success) {
      setSuccessNotice(`Laboratory "${lab.name}" archived.`);
      loadData();
    } else {
      setError(res.error?.message || 'Failed to archive laboratory.');
    }
  };

  const handleReactivateLab = async (lab: LaboratoryDto) => {
    setError(null);
    const res = await updateLaboratory(lab._id, { status: 'active' });
    if (res.success) {
      setSuccessNotice(`Laboratory "${lab.name}" reactivated.`);
      loadData();
    } else {
      setError(res.error?.message || 'Failed to reactivate laboratory.');
    }
  };

  const handlePermanentDeleteLab = async (lab: LaboratoryDto) => {
    if (
      !window.confirm(
        `PERMANENT DELETE: Are you sure you want to permanently delete laboratory "${lab.name}" (${lab.code})?\n\nThis action is irreversible. The laboratory must have zero child experiments.`
      )
    ) {
      return;
    }
    setError(null);
    const res = await deleteLaboratoryPermanently(lab._id);
    if (res.success) {
      setSuccessNotice(`Laboratory "${lab.name}" permanently deleted.`);
      loadData();
    } else {
      if (res.error?.code === 'DEPENDENT_RESOURCES_EXIST') {
        const details = res.error.details as { dependencies?: Record<string, number> } | undefined;
        setDependencyError({
          title: 'Permanent Deletion Blocked: Dependencies Exist',
          item: `${lab.name} (${lab.code})`,
          message: res.error.message || 'This laboratory cannot be deleted because dependent experiments exist.',
          dependencies: details?.dependencies,
        });
      } else {
        setError(res.error?.message || 'Failed to permanently delete laboratory.');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* View Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Configurable Academic Hierarchy
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Model your college&apos;s academic structure: Department → Course → Laboratory → Experiment.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" icon={<RefreshCw size={16} />} onClick={loadData} disabled={loading}>
            Refresh
          </Button>
          {activeTab === 'departments' && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setDeptForm({ name: '', code: '', headOfDept: '' });
                setModalType('add-dept');
              }}
            >
              Add Department
            </Button>
          )}
          {activeTab === 'courses' && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                setCourseForm({
                  departmentId: departments[0]?._id || '',
                  name: '',
                  code: '',
                  degreeLevel: 'undergraduate',
                  totalSemesters: 8,
                });
                setModalType('add-course');
              }}
              disabled={departments.length === 0}
            >
              Add Course
            </Button>
          )}
          {activeTab === 'labs' && (
            <Button
              variant="primary"
              icon={<Plus size={16} />}
              onClick={() => {
                const firstDeptId = departments[0]?._id || '';
                const matchingCourses = courses.filter((c) => {
                  const dId = typeof c.departmentId === 'object' && c.departmentId !== null ? c.departmentId._id : c.departmentId;
                  return dId === firstDeptId;
                });
                setLabForm({
                  departmentId: firstDeptId,
                  courseId: matchingCourses[0]?._id || courses[0]?._id || '',
                  name: '',
                  code: '',
                  location: '',
                  capacity: 30,
                });
                setModalType('add-lab');
              }}
              disabled={courses.length === 0}
            >
              Add Laboratory
            </Button>
          )}
        </div>
      </div>

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

      {/* Visual Hierarchy Pipeline (Institution → Department → Course → Laboratory → Experiment) */}
      <div
        className="glass-panel"
        style={{
          padding: '16px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 12,
          background: 'rgba(15, 23, 42, 0.6)',
        }}
      >
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-accent)' }}>
          Configurable Academic Hierarchy:
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <Badge variant="brand">Institution</Badge>
          <ChevronRight size={14} style={{ opacity: 0.5 }} />
          <Badge variant="info">Department</Badge>
          <ChevronRight size={14} style={{ opacity: 0.5 }} />
          <Badge variant="neutral">Course</Badge>
          <ChevronRight size={14} style={{ opacity: 0.5 }} />
          <Badge variant="warning">Laboratory</Badge>
          <ChevronRight size={14} style={{ opacity: 0.5 }} />
          <Badge variant="success">Experiment</Badge>
        </div>
      </div>

      {/* Simplified Tabs without Subject */}
      <Tabs
        tabs={[
          { id: 'departments', label: 'Departments', count: departments.length },
          { id: 'courses', label: 'Courses & Programs', count: courses.length },
          { id: 'labs', label: 'Laboratories', count: laboratories.length },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Departments Table */}
      {activeTab === 'departments' && (
        <Card padding={false}>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 12px' }} />
              <p>Loading departments...</p>
            </div>
          ) : departments.length === 0 ? (
            <div style={{ padding: '30px 20px' }}>
              <EmptyState
                title="No Departments Configured"
                description="Your institution currently has no departments registered."
                actionLabel="Create First Department"
                onAction={() => {
                  setDeptForm({ name: '', code: '', headOfDept: '' });
                  setModalType('add-dept');
                }}
              />
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Department Name</th>
                    <th>Code</th>
                    <th>Head of Department</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept._id}>
                      <td><strong>{dept.name}</strong></td>
                      <td><code>{dept.code}</code></td>
                      <td>{dept.headOfDepartment || 'Unassigned'}</td>
                      <td>
                        {dept.status === 'active' && <Badge variant="success" dot>Active</Badge>}
                        {dept.status === 'inactive' && <Badge variant="warning" dot>Inactive</Badge>}
                        {dept.status === 'archived' && <Badge variant="danger" dot>Archived</Badge>}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<Edit2 size={13} />}
                            onClick={() => {
                              setSelectedDept(dept);
                              setDeptForm({
                                name: dept.name,
                                code: dept.code,
                                headOfDept: dept.headOfDepartment || '',
                              });
                              setModalType('edit-dept');
                            }}
                          >
                            Edit
                          </Button>
                          {dept.status === 'archived' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<CheckCircle2 size={13} />}
                              onClick={() => handleReactivateDept(dept)}
                            >
                              Reactivate
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<AlertCircle size={13} />}
                              onClick={() => handleArchiveDept(dept)}
                            >
                              Archive
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<Trash2 size={13} />}
                            onClick={() => handlePermanentDeleteDept(dept)}
                            title="Permanently delete department"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* Courses Tab */}
      {activeTab === 'courses' && (
        <Card title="Degree Courses & Academic Programs" subtitle="Programs offered under college departments">
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 12px' }} />
              <p>Loading course curricula...</p>
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              title="No Courses Configured"
              description="No academic degree programs have been added yet."
              actionLabel="Create First Course"
              onAction={() => {
                setCourseForm({
                  departmentId: departments[0]?._id || '',
                  name: '',
                  code: '',
                  degreeLevel: 'undergraduate',
                  totalSemesters: 8,
                });
                setModalType('add-course');
              }}
            />
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Course / Degree</th>
                    <th>Code</th>
                    <th>Department</th>
                    <th>Degree Level</th>
                    <th>Total Semesters</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {courses.map((course) => {
                    const deptName =
                      typeof course.departmentId === 'object' && course.departmentId !== null
                        ? course.departmentId.name
                        : departments.find((d) => d._id === course.departmentId)?.name || 'Department';
                    return (
                      <tr key={course._id}>
                        <td><strong>{course.name}</strong></td>
                        <td><code>{course.code}</code></td>
                        <td>{deptName}</td>
                        <td>{course.degreeLevel.toUpperCase()}</td>
                        <td>{course.totalSemesters} Semesters</td>
                        <td>
                          {course.status === 'active' && <Badge variant="success" dot>Active</Badge>}
                          {course.status !== 'active' && <Badge variant="neutral" dot>{course.status}</Badge>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<Edit2 size={13} />}
                              onClick={() => {
                                setSelectedCourse(course);
                                setCourseForm({
                                  departmentId: typeof course.departmentId === 'object' && course.departmentId !== null ? course.departmentId._id : course.departmentId,
                                  name: course.name,
                                  code: course.code,
                                  degreeLevel: course.degreeLevel,
                                  totalSemesters: course.totalSemesters,
                                });
                                setModalType('edit-course');
                              }}
                            >
                              Edit
                            </Button>
                            {course.status === 'archived' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<CheckCircle2 size={13} />}
                                onClick={() => handleReactivateCourse(course)}
                              >
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<AlertCircle size={13} />}
                                onClick={() => handleArchiveCourse(course)}
                              >
                                Archive
                              </Button>
                            )}
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<Trash2 size={13} />}
                              onClick={() => handlePermanentDeleteCourse(course)}
                              title="Permanently delete course"
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
        </Card>
      )}

      {/* Laboratories Tab */}
      {activeTab === 'labs' && (
        <Card title="Laboratories Catalog" subtitle="Practical lab facilities hosting authorized experiments">
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="spin-icon" style={{ margin: '0 auto 12px' }} />
              <p>Loading laboratories...</p>
            </div>
          ) : laboratories.length === 0 ? (
            <EmptyState
              title="No Laboratories Configured"
              description="No laboratory facilities have been registered yet."
              actionLabel="Add Laboratory"
              onAction={() => {
                const firstDeptId = departments[0]?._id || '';
                const matchingCourses = courses.filter((c) => {
                  const dId = typeof c.departmentId === 'object' && c.departmentId !== null ? c.departmentId._id : c.departmentId;
                  return dId === firstDeptId;
                });
                setLabForm({
                  departmentId: firstDeptId,
                  courseId: matchingCourses[0]?._id || courses[0]?._id || '',
                  name: '',
                  code: '',
                  location: '',
                  capacity: 30,
                });
                setModalType('add-lab');
              }}
            />
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Laboratory Name</th>
                    <th>Code</th>
                    <th>Course &amp; Department</th>
                    <th>Capacity</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {laboratories.map((lab) => {
                    const labCourseId = typeof lab.courseId === 'object' && lab.courseId !== null ? (lab.courseId as any)._id : lab.courseId;
                    const labDeptId = typeof lab.departmentId === 'object' && lab.departmentId !== null ? (lab.departmentId as any)._id : lab.departmentId;
                    const matchedCourse = courses.find((c) => c._id === labCourseId);
                    const courseDisplay = matchedCourse ? `${matchedCourse.name} (${matchedCourse.code})` : 'Course Assigned';
                    return (
                      <tr key={lab._id}>
                        <td><strong>{lab.name}</strong></td>
                        <td><code>{lab.code}</code></td>
                        <td>{courseDisplay}</td>
                        <td>{lab.capacity ? `${lab.capacity} Students` : '30 Students'}</td>
                        <td>
                          {lab.status === 'active' && <Badge variant="success" dot>Active</Badge>}
                          {lab.status !== 'active' && <Badge variant="neutral" dot>{lab.status}</Badge>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<Edit2 size={13} />}
                              onClick={() => {
                                setSelectedLab(lab);
                                setLabForm({
                                  departmentId: labDeptId || departments[0]?._id || '',
                                  courseId: labCourseId || courses[0]?._id || '',
                                  name: lab.name,
                                  code: lab.code,
                                  location: lab.location || '',
                                  capacity: lab.capacity || 30,
                                });
                                setModalType('edit-lab');
                              }}
                            >
                              Edit
                            </Button>
                            {lab.status === 'inactive' || lab.status === 'archived' ? (
                              <Button
                                variant="outline"
                                size="sm"
                                icon={<CheckCircle2 size={13} />}
                                onClick={() => handleReactivateLab(lab)}
                              >
                                Reactivate
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={<AlertCircle size={13} />}
                                onClick={() => handleArchiveLab(lab)}
                              >
                                Archive
                              </Button>
                            )}
                            <Button
                              variant="danger"
                              size="sm"
                              icon={<Trash2 size={13} />}
                              onClick={() => handlePermanentDeleteLab(lab)}
                              title="Permanently delete laboratory"
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
        </Card>
      )}

      {/* ================= MODAL DIALOGS ================= */}
      {/* Department Modal */}
      <ModalDialog
        isOpen={modalType === 'add-dept' || modalType === 'edit-dept'}
        onClose={() => setModalType(null)}
        title={modalType === 'add-dept' ? 'Add Department' : `Edit Department: ${selectedDept?.name || ''}`}
        description="Autonomous department container for courses, laboratories, and experiments."
      >
        <form onSubmit={handleSaveDept}>
          <FormField label="Department Name" required>
            <input
              type="text"
              required
              className="form-input"
              value={deptForm.name}
              onChange={(e) => setDeptForm({ ...deptForm, name: e.target.value })}
            />
          </FormField>
          <div className="grid-2">
            <FormField label="Department Code" required>
              <input
                type="text"
                required
                className="form-input"
                disabled={modalType === 'edit-dept'}
                value={deptForm.code}
                onChange={(e) => setDeptForm({ ...deptForm, code: e.target.value.toUpperCase() })}
              />
            </FormField>
            <FormField label="Head of Department" required>
              <input
                type="text"
                required
                className="form-input"
                value={deptForm.headOfDept}
                onChange={(e) => setDeptForm({ ...deptForm, headOfDept: e.target.value })}
              />
            </FormField>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button variant="outline" type="button" onClick={() => setModalType(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Department'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Course Modal */}
      <ModalDialog
        isOpen={modalType === 'add-course' || modalType === 'edit-course'}
        onClose={() => setModalType(null)}
        title={modalType === 'add-course' ? 'Add Course / Program' : `Edit Course: ${selectedCourse?.name || ''}`}
      >
        <form onSubmit={handleSaveCourse}>
          {modalType === 'add-course' && (
            <FormField label="Parent Department" required>
              <select
                className="form-select"
                value={courseForm.departmentId}
                onChange={(e) => setCourseForm({ ...courseForm, departmentId: e.target.value })}
              >
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </FormField>
          )}
          <FormField label="Course Name" required>
            <input
              type="text"
              required
              className="form-input"
              value={courseForm.name}
              onChange={(e) => setCourseForm({ ...courseForm, name: e.target.value })}
            />
          </FormField>
          <div className="grid-2">
            <FormField label="Course Code" required>
              <input
                type="text"
                required
                className="form-input"
                disabled={modalType === 'edit-course'}
                value={courseForm.code}
                onChange={(e) => setCourseForm({ ...courseForm, code: e.target.value.toUpperCase() })}
              />
            </FormField>
            <FormField label="Degree Level" required>
              <select
                className="form-select"
                value={courseForm.degreeLevel}
                onChange={(e) => setCourseForm({ ...courseForm, degreeLevel: e.target.value })}
              >
                <option value="undergraduate">Undergraduate</option>
                <option value="postgraduate">Postgraduate</option>
                <option value="diploma">Diploma</option>
                <option value="doctoral">Doctoral</option>
              </select>
            </FormField>
          </div>
          <FormField label="Total Semesters" required>
            <input
              type="number"
              min={1}
              max={12}
              required
              className="form-input"
              value={courseForm.totalSemesters}
              onChange={(e) => setCourseForm({ ...courseForm, totalSemesters: Number(e.target.value) })}
            />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button variant="outline" type="button" onClick={() => setModalType(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Course'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Laboratory Modal (Directly under Department & Course, no Subject required) */}
      <ModalDialog
        isOpen={modalType === 'add-lab' || modalType === 'edit-lab'}
        onClose={() => setModalType(null)}
        title={modalType === 'add-lab' ? 'Add Laboratory' : `Edit Laboratory: ${selectedLab?.name || ''}`}
        description="Configure a practical laboratory container directly under a degree course."
      >
        <form onSubmit={handleSaveLab}>
          {modalType === 'add-lab' && (
            <div className="grid-2">
              <FormField label="Department" required>
                <select
                  className="form-select"
                  value={labForm.departmentId}
                  onChange={(e) => handleLabDepartmentChange(e.target.value)}
                >
                  {departments.map((d) => (
                    <option key={d._id} value={d._id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </FormField>
              <FormField label="Parent Course / Program" required>
                <select
                  className="form-select"
                  value={labForm.courseId}
                  onChange={(e) => setLabForm({ ...labForm, courseId: e.target.value })}
                >
                  {courses
                    .filter((c) => {
                      const dId = typeof c.departmentId === 'object' && c.departmentId !== null ? c.departmentId._id : c.departmentId;
                      return !labForm.departmentId || dId === labForm.departmentId;
                    })
                    .map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                </select>
              </FormField>
            </div>
          )}
          <FormField label="Laboratory Name" required>
            <input
              type="text"
              required
              className="form-input"
              value={labForm.name}
              onChange={(e) => setLabForm({ ...labForm, name: e.target.value })}
            />
          </FormField>
          <div className="grid-2">
            <FormField label="Laboratory Code" required>
              <input
                type="text"
                required
                className="form-input"
                disabled={modalType === 'edit-lab'}
                value={labForm.code}
                onChange={(e) => setLabForm({ ...labForm, code: e.target.value.toUpperCase() })}
              />
            </FormField>
            <FormField label="Student Capacity" required>
              <input
                type="number"
                min={1}
                max={200}
                required
                className="form-input"
                value={labForm.capacity}
                onChange={(e) => setLabForm({ ...labForm, capacity: Number(e.target.value) })}
              />
            </FormField>
          </div>
          <FormField label="Location / Room (Optional)">
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Science Block, Lab Room 302"
              value={labForm.location}
              onChange={(e) => setLabForm({ ...labForm, location: e.target.value })}
            />
          </FormField>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <Button variant="outline" type="button" onClick={() => setModalType(null)} disabled={submitting}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : 'Save Laboratory'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Dependency Blocked Explanation Modal */}
      <ModalDialog
        isOpen={Boolean(dependencyError)}
        onClose={() => setDependencyError(null)}
        title={dependencyError?.title || 'Action Blocked by Dependencies'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 'var(--radius-sm)' }}>
            <ShieldAlert size={22} style={{ color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
            <div>
              <p style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                Target: {dependencyError?.item}
              </p>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {dependencyError?.message}
              </p>
            </div>
          </div>

          {dependencyError?.dependencies && (
            <div>
              <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase' }}>
                Existing Dependent Records:
              </p>
              <ul style={{ paddingLeft: 20, margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(dependencyError.dependencies).map(([key, count]) => (
                  <li key={key}>
                    <strong>{count}</strong> {key}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ padding: '10px 14px', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            💡 To proceed, please archive, relocate, or remove child items before deleting this parent container.
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="outline" onClick={() => setDependencyError(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
};
