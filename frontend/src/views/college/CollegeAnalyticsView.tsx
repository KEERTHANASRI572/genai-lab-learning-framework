import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, TrendingUp, Users, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { Card, MetricCard } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Alert } from '../../components/common/Alert';
import { Button } from '../../components/common/Button';
import { useApp } from '../../context/AppContext';
import { getCollegeAnalytics, CollegeAnalyticsDto } from '../../services/api';

export const CollegeAnalyticsView: React.FC = () => {
  const { activeInstitution } = useApp();
  const [analytics, setAnalytics] = useState<CollegeAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCollegeAnalytics();
      if (res.success && res.data) {
        setAnalytics(res.data);
      } else {
        setError(res.error?.message || 'Failed to load institutional analytics.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {activeInstitution || 'Institution'} — Learning Analytics
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Real institutional engagement metrics, laboratory experiment completion rates, and curriculum throughput from MongoDB Atlas.
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchAnalytics}>
          Refresh
        </Button>
      </div>

      {error && (
        <Alert type="danger" title="Error Loading Analytics">
          {error}
        </Alert>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Aggregating telemetry from database...
        </div>
      ) : (
        <>
          <div className="grid-4">
            <MetricCard
              title="Scheduled Lab Sessions"
              value={analytics ? analytics.scheduledSessions.toString() : '0'}
              subtitle={analytics && analytics.scheduledSessions > 0 ? `${analytics.completedSessions} completed` : 'Awaiting scheduled lab runs'}
              icon={<Clock size={20} />}
            />
            <MetricCard
              title="Active Students"
              value={analytics ? analytics.activeStudents.toString() : '0'}
              subtitle={analytics ? `Across ${analytics.departmentsCount} department(s)` : 'Enrolled students'}
              icon={<Users size={20} />}
            />
            <MetricCard
              title="Lab Completion Rate"
              value={
                analytics && analytics.completionRatePercent !== null
                  ? `${analytics.completionRatePercent}%`
                  : 'No data available'
              }
              subtitle={
                analytics && analytics.completionRatePercent !== null
                  ? `${analytics.completedSessions} of ${analytics.scheduledSessions} sessions completed`
                  : 'Awaiting student session submissions'
              }
              icon={<CheckCircle size={20} />}
            />
            <MetricCard
              title="AI Assistance Invocations"
              value={analytics ? analytics.aiInvocations.toString() : '0'}
              subtitle={
                analytics && analytics.aiInvocations > 0
                  ? 'Grounded RAG prompt queries'
                  : 'Logged during interactive experiments'
              }
              icon={<TrendingUp size={20} />}
            />
          </div>

          <Card title="Departmental Laboratory Engagement" subtitle="Session and laboratory counts by academic department">
            {!analytics || analytics.departmentalEngagement.length === 0 ? (
              <EmptyState
                title="No Departmental Telemetry"
                description="Analytics will populate automatically as departments configure active laboratories and students begin running sessions."
                icon={<BarChart3 size={28} />}
              />
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Department</th>
                      <th>Code</th>
                      <th>Active Laboratories</th>
                      <th>Enrolled Students</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.departmentalEngagement.map((dept) => (
                      <tr key={dept.departmentId}>
                        <td>
                          <strong>{dept.name}</strong>
                        </td>
                        <td>
                          <code>{dept.code}</code>
                        </td>
                        <td>{dept.labsCount} Lab{dept.labsCount !== 1 ? 's' : ''}</td>
                        <td>{dept.studentsCount} Student{dept.studentsCount !== 1 ? 's' : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
};
