import React, { useState, useEffect } from 'react';
import { BookOpen, FlaskConical, Users, AlertTriangle, ArrowRight, CheckCircle2, Plus, Loader2, RefreshCw } from 'lucide-react';
import { Card, MetricCard } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { EmptyState } from '../../components/common/EmptyState';
import { useApp } from '../../context/AppContext';
import { getFacultyDashboard, FacultyDashboardDto } from '../../services/api';

export const FacultyDashboardView: React.FC = () => {
  const { setCurrentView, setActiveExperimentId } = useApp();
  const [data, setData] = useState<FacultyDashboardDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFacultyDashboard();
      if (res.success && res.data) {
        setData(res.data);
      } else {
        setError(res.error?.message || 'Failed to load faculty dashboard metrics.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error loading dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleEditExperiment = (expId: string) => {
    setActiveExperimentId(expId);
    setCurrentView('faculty-experiments');
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: 'var(--brand-primary)' }} />
          <span style={{ marginLeft: 12, color: 'var(--text-secondary)' }}>Loading assignment-based laboratory data...</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Faculty Workbench & Assigned Laboratories
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Author laboratory experiments, upload verified RAG resources, review diagnostic assessments, and respond to student escalations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Button variant="outline" icon={<RefreshCw size={15} />} onClick={fetchDashboard}>
            Refresh
          </Button>
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCurrentView('faculty-experiments')}>
            Author New Experiment
          </Button>
        </div>
      </div>

      {error && (
        <Alert type="danger" title="Dashboard Error">
          {error}
        </Alert>
      )}

      {/* Assignment Status Notice */}
      {data && !data.hasAssignment && (
        <Alert type="warning" title="No Course or Laboratory Assignments Configured">
          Your faculty account is not currently assigned to a department or course programme. Please contact your College Administrator to configure your departmental assignment so your assigned laboratories and students will appear here.
        </Alert>
      )}

      {/* Active Academic Hierarchy banner */}
      <div
        style={{
          padding: '10px 16px',
          background: 'rgba(99, 102, 241, 0.08)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.8rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>Active Academic Hierarchy:</span>
          <span style={{ color: 'var(--text-secondary)' }}>Institution → Department → Course → Laboratory → Experiment</span>
        </div>
        {data?.faculty?.course && (
          <Badge variant="brand">Assigned: {data.faculty.course} ({data.faculty.courseCode || 'N/A'})</Badge>
        )}
      </div>

      {/* 4 Metric Cards - 100% Data-Driven */}
      <div className="grid-4">
        <MetricCard
          title="Assigned Laboratories"
          value={data ? `${data.metrics.assignedLabsCount} Labs` : '0 Labs'}
          subtitle={data?.faculty?.course ? `${data.faculty.courseCode || data.faculty.course}` : 'No assigned lab'}
          icon={<BookOpen size={20} />}
        />
        <MetricCard
          title="Active Experiments"
          value={data ? `${data.metrics.activeExperimentsCount} Modules` : '0 Modules'}
          subtitle={data?.metrics.totalExperimentsCount ? `${data.metrics.totalExperimentsCount} total modules in scope` : 'No active experiments'}
          icon={<FlaskConical size={20} />}
        />
        <MetricCard
          title="Enrolled Lab Students"
          value={data ? `${data.metrics.enrolledStudentsCount} Students` : '0 Students'}
          subtitle={data?.faculty?.department ? `${data.faculty.departmentCode || data.faculty.department}` : 'Enrolled cohort'}
          icon={<Users size={20} />}
        />
        <MetricCard
          title="Pending AI Escalations"
          value={data ? `${data.metrics.pendingEscalationsCount} Inquiries` : '0 Inquiries'}
          subtitle={data?.metrics.pendingEscalationsCount ? 'Awaiting faculty review' : 'Queue clear'}
          icon={<AlertTriangle size={20} />}
        />
      </div>

      {/* Pending Escalations Alert Banner - Only shown when real escalations exist */}
      {data && data.metrics.pendingEscalationsCount > 0 && (
        <Alert
          type="warning"
          title={`Pending Student AI Escalations (${data.metrics.pendingEscalationsCount}) Awaiting Review`}
        >
          {data.metrics.pendingEscalationsCount} student inquiry has been escalated from laboratory executions where automated guidance paused.
          <div style={{ marginTop: 8 }}>
            <Button variant="outline" size="sm" onClick={() => setCurrentView('faculty-help-requests')}>
              Triage Escalations <ArrowRight size={14} />
            </Button>
          </div>
        </Alert>
      )}

      {/* Real Experiments Curriculum List */}
      <Card
        title="My Laboratory Curriculum"
        subtitle="Experiments with configured diagnostic assessments, step procedures, and safety protocols"
        headerAction={
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('faculty-experiments')}>
            Manage All Experiments
          </Button>
        }
      >
        {(!data || data.experiments.length === 0) ? (
          <EmptyState
            title="No Laboratory Experiments Available"
            description={
              data?.hasAssignment
                ? "No experiments have been configured for your assigned laboratories yet. Click 'Author New Experiment' to create your first laboratory module."
                : "No experiments can be displayed because you have no assigned course or laboratory. Contact your College Administrator."
            }
            icon={<FlaskConical size={28} />}
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Experiment Code & Title</th>
                  <th>Laboratory</th>
                  <th>Diagnostic Quiz</th>
                  <th>Safety Protocol</th>
                  <th>Active Learners</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.experiments.map((exp) => (
                  <tr key={exp.id}>
                    <td>
                      <strong>{exp.code ? `${exp.code}: ` : ''}{exp.title}</strong>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {exp.stepCount} Steps · {exp.equipmentCount} Apparatus Items
                      </div>
                    </td>
                    <td>
                      <span>{exp.labName}</span>
                      {exp.labCode && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block' }}>({exp.labCode})</span>}
                    </td>
                    <td>
                      {exp.diagnosticQuiz.configured ? (
                        <Badge variant="success">Active ({exp.diagnosticQuiz.questionCount} Questions)</Badge>
                      ) : (
                        <Badge variant="neutral">Not Configured</Badge>
                      )}
                    </td>
                    <td>
                      {exp.safetyProtocol.hasSafetyRules ? (
                        <Badge variant="warning">{exp.safetyProtocol.safetyNoticeCount} Safety Rules</Badge>
                      ) : (
                        <Badge variant="neutral">Standard Safety</Badge>
                      )}
                    </td>
                    <td>{exp.activeLearners} Learners</td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditExperiment(exp.id)}
                      >
                        Edit Protocol
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
