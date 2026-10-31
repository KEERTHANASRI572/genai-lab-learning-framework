import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, CheckCircle, Clock, Loader2, BookOpen } from 'lucide-react';
import { Card, MetricCard } from '../../components/common/Card';
import { EmptyState } from '../../components/common/EmptyState';
import { Alert } from '../../components/common/Alert';
import { getFacultyAnalytics, FacultyAnalyticsDto } from '../../services/api';

export const FacultyAnalyticsView: React.FC = () => {
  const [analytics, setAnalytics] = useState<FacultyAnalyticsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setIsLoading(true);
      setError(null);
      const res = await getFacultyAnalytics();
      if (res.success && res.data) {
        setAnalytics(res.data);
      } else {
        setError(res.error?.message || 'Failed to retrieve faculty analytics.');
      }
      setIsLoading(false);
    }
    loadData();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Curriculum Analytics & Assessment Performance
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Real-time student diagnostic baselines, post-lab summative gains, and procedural step metrics computed from MongoDB Atlas.
        </p>
      </div>

      {error && (
        <Alert type="danger" title="Analytics Loading Error">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Computing live cohort analytics from database...</span>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid-4">
            <MetricCard
              title="Diagnostic Assessment Avg"
              value={
                analytics?.diagnosticAvg !== null && analytics?.diagnosticAvg !== undefined
                  ? `${analytics.diagnosticAvg}%`
                  : 'N/A'
              }
              subtitle={
                analytics?.totalDiagnosticAttempts
                  ? `Based on ${analytics.totalDiagnosticAttempts} student baseline attempt(s)`
                  : 'No student diagnostic attempts yet'
              }
              icon={<CheckCircle size={20} />}
            />
            <MetricCard
              title="Summative Assessment Avg"
              value={
                analytics?.summativeAvg !== null && analytics?.summativeAvg !== undefined
                  ? `${analytics.summativeAvg}%`
                  : 'N/A'
              }
              subtitle={
                analytics?.totalSummativeAttempts
                  ? `Based on ${analytics.totalSummativeAttempts} post-lab submission(s)`
                  : 'No post-lab submissions yet'
              }
              icon={<TrendingUp size={20} />}
            />
            <MetricCard
              title="Avg Experiment Duration"
              value={
                analytics?.avgDurationMins !== null && analytics?.avgDurationMins !== undefined
                  ? `${analytics.avgDurationMins} mins`
                  : 'N/A'
              }
              subtitle={
                analytics?.avgDurationMins !== null
                  ? 'Calculated from completed sessions'
                  : 'Awaiting lab session completions'
              }
              icon={<Clock size={20} />}
            />
            <MetricCard
              title="Institutional Resources"
              value={String(analytics?.learningResourcesCount ?? 0)}
              subtitle="Verified curriculum documents in Atlas"
              icon={<BookOpen size={20} />}
            />
          </div>

          <Card
            title="Assessment Discrimination & Step Duration Matrix"
            subtitle="Calculated procedural step scores and discrimination metrics from student submissions"
          >
            {analytics?.stepMatrix && analytics.stepMatrix.length > 0 ? (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Procedural Step</th>
                      <th>Submissions</th>
                      <th>Average Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analytics.stepMatrix.map((item, idx) => (
                      <tr key={idx}>
                        <td><strong>{item.step}</strong></td>
                        <td>{item.attemptsCount} attempts</td>
                        <td>
                          <span
                            style={{
                              fontWeight: 600,
                              color: item.avgScore >= 70 ? 'var(--success)' : item.avgScore >= 40 ? 'var(--warning)' : 'var(--danger)',
                            }}
                          >
                            {item.avgScore}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                title="No Cohort Submissions Available"
                description={
                  analytics?.hasAttempts
                    ? 'Individual step breakdown is currently being compiled from student telemetry.'
                    : 'Detailed procedural step scores and discrimination metrics will appear dynamically once students complete lab assessment steps.'
                }
                icon={<BarChart3 size={32} />}
              />
            )}
          </Card>
        </>
      )}
    </div>
  );
};
