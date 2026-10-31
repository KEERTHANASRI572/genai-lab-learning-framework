import React, { useEffect, useState, useCallback } from 'react';
import {
  FlaskConical,
  Clock,
  BookOpen,
  ArrowRight,
  AlertTriangle,
  Loader2,
  ChevronRight,
  CheckCircle2,
  Check,
  PlayCircle,
  HelpCircle,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { EmptyState } from '../../components/common/EmptyState';
import { useApp } from '../../context/AppContext';
import {
  getCourses,
  getLaboratories,
  getExperiments,
  getStudentProgress,
  CourseDto,
  LaboratoryDto,
  ExperimentDto,
} from '../../services/api';

export const ExperimentBrowserView: React.FC = () => {
  const {
    setCurrentView,
    activeExperimentId,
    activeExperimentCode,
    setActiveExperimentId,
    activeCourseId,
    activeCourseName,
    activeLabId,
    activeLabName,
    setActiveCourseId,
    setActiveLabId,
  } = useApp();

  const [courses, setCourses] = useState<CourseDto[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratoryDto[]>([]);
  const [experiments, setExperiments] = useState<ExperimentDto[]>([]);
  const [studentProgress, setStudentProgress] = useState<{ sessions: any[]; attempts: any[] }>({
    sessions: [],
    attempts: [],
  });

  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingLaboratories, setLoadingLaboratories] = useState(false);
  const [loadingExperiments, setLoadingExperiments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Load institutional courses
  const loadCourses = useCallback(async () => {
    setLoadingCourses(true);
    setError(null);
    try {
      const res = await getCourses();
      if (res.success && res.data) {
        setCourses(res.data);
        if (res.data.length > 0) {
          const match = activeCourseId ? res.data.find((c) => c._id === activeCourseId) : res.data[0];
          const chosen = match || res.data[0];
          setActiveCourseId(chosen._id, chosen.name);
        }
      } else {
        setError(res.error?.message || 'Failed to query courses for your institution.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(`NETWORK_ERROR: ${msg}`);
    } finally {
      setLoadingCourses(false);
    }
  }, [activeCourseId, setActiveCourseId]);

  useEffect(() => {
    loadCourses();
  }, [loadCourses]);

  // Load student learning progress to know completed steps per experiment
  useEffect(() => {
    let mounted = true;
    async function loadProgress() {
      try {
        const res = await getStudentProgress();
        if (mounted && res.success && res.data) {
          setStudentProgress({
            sessions: res.data.sessions || [],
            attempts: res.data.attempts || [],
          });
        }
      } catch {
        // Non-blocking progress load
      }
    }
    loadProgress();
    return () => {
      mounted = false;
    };
  }, []);

  // 2. Load laboratories whenever activeCourseId changes
  useEffect(() => {
    if (!activeCourseId) {
      setLaboratories([]);
      return;
    }

    let mounted = true;
    async function loadLabsForCourse() {
      setLoadingLaboratories(true);
      setError(null);
      try {
        const res = await getLaboratories({ courseId: activeCourseId || undefined });
        if (!mounted) return;
        if (res.success && res.data) {
          setLaboratories(res.data);
          if (res.data.length > 0) {
            const match = activeLabId ? res.data.find((l) => l._id === activeLabId) : res.data[0];
            const chosen = match || res.data[0];
            setActiveLabId(chosen._id, chosen.name);
          } else {
            setActiveLabId(null, '');
          }
        }
      } catch (err: unknown) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to query laboratories.';
        setError(`NETWORK_ERROR: ${msg}`);
      } finally {
        if (mounted) setLoadingLaboratories(false);
      }
    }

    loadLabsForCourse();
    return () => {
      mounted = false;
    };
  }, [activeCourseId, setActiveLabId]);

  // 3. Load experiments whenever activeLabId changes
  useEffect(() => {
    if (!activeLabId) {
      setExperiments([]);
      return;
    }

    let mounted = true;
    async function loadExpsForLab() {
      setLoadingExperiments(true);
      setError(null);
      try {
        let res = await getExperiments({ laboratoryId: activeLabId || undefined, status: 'published' });
        if (!mounted) return;
        if (res.success && res.data && res.data.length > 0) {
          setExperiments(res.data);
          // If no experiment selected, auto-select the first published experiment
          if (!activeExperimentId) {
            const first = res.data[0];
            setActiveExperimentId(first._id, first.title, first.code);
          }
        } else {
          // If no experiments found directly under lab, check if lab has a legacy subjectId fallback
          const currentLab = laboratories.find((l) => l._id === activeLabId);
          if (currentLab?.subjectId) {
            const legacyRes = await getExperiments({ subjectId: currentLab.subjectId, status: 'published' });
            if (mounted && legacyRes.success && legacyRes.data) {
              setExperiments(legacyRes.data);
              if (!activeExperimentId && legacyRes.data.length > 0) {
                const first = legacyRes.data[0];
                setActiveExperimentId(first._id, first.title, first.code);
              }
              return;
            }
          }
          if (mounted) setExperiments(res.data || []);
        }
      } catch (err: unknown) {
        if (!mounted) return;
        const msg = err instanceof Error ? err.message : 'Failed to query experiments.';
        setError(`NETWORK_ERROR: ${msg}`);
      } finally {
        if (mounted) setLoadingExperiments(false);
      }
    }

    loadExpsForLab();
    return () => {
      mounted = false;
    };
  }, [activeLabId, laboratories, activeExperimentId, setActiveExperimentId]);

  // Determine experiment completion stage
  const getExperimentStatus = (expId: string) => {
    const hasDiagnosticAttempt = studentProgress.attempts.some(
      (a) => (a.experimentId?._id === expId || a.experimentId === expId) && a.type === 'initial_diagnostic'
    );
    const session = studentProgress.sessions.find(
      (s) => s.experimentId?._id === expId || s.experimentId === expId
    );
    const isSessionComplete = session?.status === 'completed';
    const hasFinalAttempt = studentProgress.attempts.some(
      (a) => (a.experimentId?._id === expId || a.experimentId === expId) && a.type === 'final_summative'
    );

    return {
      hasDiagnosticAttempt,
      session,
      isSessionComplete,
      hasFinalAttempt,
    };
  };

  const handleSelectCard = (exp: ExperimentDto) => {
    setActiveExperimentId(exp._id, exp.title, exp.code);
  };

  const handleLaunchExperiment = (exp: ExperimentDto) => {
    setActiveExperimentId(exp._id, exp.title, exp.code);
    const status = getExperimentStatus(exp._id);

    if (!status.hasDiagnosticAttempt) {
      setCurrentView('student-experiment-overview');
    } else if (!status.isSessionComplete) {
      setCurrentView('student-workspace');
    } else {
      setCurrentView('student-final-assessment');
    }
  };

  // Empty state: No enrolled courses
  if (!loadingCourses && courses.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Course &amp; Laboratory Selection
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Academic enrollment for laboratory practice and diagnostics.
          </p>
        </div>
        <Card>
          <EmptyState
            title="No Enrolled Courses Found"
            description="Your student account has no enrolled courses in this institution. Please contact your College Administrator or Department Faculty to assign your curriculum."
          />
        </Card>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* View Header */}
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Course &amp; Laboratory Selection: Experiment Catalog
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Step 1: Select your degree course → Step 2: Choose your laboratory → Step 3: Launch authorized experiment.
        </p>
      </div>

      {error && (
        <Alert type="danger" title="Curriculum Notice">
          {error}
        </Alert>
      )}

      {/* Hierarchy Step Selector Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '18px 22px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          background: 'rgba(15, 23, 42, 0.75)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-accent)', textTransform: 'uppercase' }}>
            Current Academic Context:
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.85rem' }}>
            <Badge variant="brand">{activeCourseName || 'Select Course'}</Badge>
            <ChevronRight size={14} style={{ opacity: 0.5 }} />
            <Badge variant={activeLabId ? 'success' : 'neutral'}>
              {activeLabName || 'Select Laboratory'}
            </Badge>
            {activeExperimentCode && (
              <>
                <ChevronRight size={14} style={{ opacity: 0.5 }} />
                <Badge variant="brand" dot>
                  Active: {activeExperimentCode}
                </Badge>
              </>
            )}
          </div>
        </div>

        <div className="grid-2">
          {/* 1. Course Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              1. Enrolled Degree Course / Program:
            </label>
            <select
              className="form-select"
              value={activeCourseId || ''}
              onChange={(e) => {
                const cId = e.target.value;
                const found = courses.find((c) => c._id === cId);
                setActiveCourseId(cId, found?.name);
              }}
              disabled={loadingCourses}
            >
              {courses.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.code}) - {c.degreeLevel.toUpperCase()}
                </option>
              ))}
            </select>
          </div>

          {/* 2. Laboratory Selector */}
          <div>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>
              2. Laboratory Facility / Module:
            </label>
            <select
              className="form-select"
              value={activeLabId || ''}
              onChange={(e) => {
                const lId = e.target.value;
                const found = laboratories.find((l) => l._id === lId);
                setActiveLabId(lId, found?.name);
              }}
              disabled={loadingLaboratories || laboratories.length === 0}
            >
              {laboratories.length === 0 && <option value="">No laboratories configured under this course</option>}
              {laboratories.map((l) => (
                <option key={l._id} value={l._id}>
                  {l.name} ({l.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Experiments List */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Authorized Experiments for {activeLabName || 'Selected Laboratory'}
          </h2>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {experiments.length} published experiment{experiments.length === 1 ? '' : 's'}
          </span>
        </div>

        {loadingExperiments ? (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', justifyContent: 'center' }}>
              <Loader2 className="animate-spin" size={24} style={{ color: 'var(--brand-primary)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>Loading experiments for {activeLabName}...</span>
            </div>
          </Card>
        ) : !activeLabId ? (
          <Alert type="warning" title="Laboratory Required">
            Please choose a laboratory from the selector above to view and launch experiments.
          </Alert>
        ) : experiments.length === 0 ? (
          <Card>
            <EmptyState
              title="No Experiments Found for Laboratory"
              description={`There are currently no published laboratory experiments under "${activeLabName}". Please notify your course faculty.`}
            />
          </Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {experiments.map((exp) => {
              const isSelected = activeExperimentId === exp._id;
              const status = getExperimentStatus(exp._id);

              return (
                <div
                  key={exp._id}
                  onClick={() => handleSelectCard(exp)}
                  style={{
                    borderRadius: 'var(--radius-md)',
                    border: isSelected
                      ? '2px solid var(--brand-primary)'
                      : '1px solid var(--border-subtle)',
                    background: isSelected
                      ? 'rgba(30, 41, 59, 0.7)'
                      : 'rgba(15, 23, 42, 0.5)',
                    boxShadow: isSelected ? '0 0 16px rgba(99, 102, 241, 0.25)' : 'none',
                    padding: '20px 24px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  className="animate-fade-in"
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 16,
                    }}
                  >
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', flex: 1, minWidth: 280 }}>
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 'var(--radius-sm)',
                          background: isSelected ? 'var(--brand-primary)' : 'rgba(99, 102, 241, 0.1)',
                          color: isSelected ? '#ffffff' : 'var(--text-accent)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <FlaskConical size={24} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                          <Badge variant="brand">{exp.code}</Badge>
                          <Badge variant="success">Published &amp; Authorized</Badge>
                          {isSelected && <Badge variant="brand" dot>Selected Active Experiment</Badge>}
                          {status.hasDiagnosticAttempt && (
                            <Badge variant="neutral">Diagnostic Complete</Badge>
                          )}
                          {status.isSessionComplete && (
                            <Badge variant="success">Lab Complete</Badge>
                          )}
                        </div>
                        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          {exp.title}
                        </h3>
                        {exp.description && (
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: 4, maxWidth: 650 }}>
                            {exp.description}
                          </p>
                        )}
                        <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: '0.8rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={14} /> {exp.estimatedDurationMins || 90} mins
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--warning)' }}>
                            <AlertTriangle size={14} /> Safety Gate Enforced
                          </span>
                          <span>{exp.procedureSteps?.length || 0} Procedure Steps</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveExperimentId(exp._id, exp.title, exp.code);
                          setCurrentView('student-experiment-overview');
                        }}
                      >
                        Overview &amp; Safety
                      </Button>

                      <Button
                        variant="primary"
                        icon={<ArrowRight size={16} />}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleLaunchExperiment(exp);
                        }}
                      >
                        {!status.hasDiagnosticAttempt
                          ? 'Start Diagnostic & Lab'
                          : !status.isSessionComplete
                          ? 'Continue Interactive Lab'
                          : 'Final Assessment'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
