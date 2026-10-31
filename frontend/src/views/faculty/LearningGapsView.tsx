import React, { useState, useEffect } from 'react';
import { AlertTriangle, HelpCircle, UserX, CheckCircle, Loader2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { EmptyState } from '../../components/common/EmptyState';
import { Alert } from '../../components/common/Alert';
import { getFacultyLearningGaps, FacultyLearningGapDto } from '../../services/api';

export const LearningGapsView: React.FC = () => {
  const [gaps, setGaps] = useState<FacultyLearningGapDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadGaps() {
      setIsLoading(true);
      setError(null);
      const res = await getFacultyLearningGaps();
      if (res.success && res.data) {
        setGaps(res.data);
      } else {
        setError(res.error?.message || 'Failed to retrieve learning gaps analysis.');
      }
      setIsLoading(false);
    }
    loadGaps();
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Learning Gaps, Repeated Mistakes & Student Assistance
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Real-time procedural misconceptions and conceptual gaps aggregated from genuine student assessment attempts in MongoDB Atlas.
        </p>
      </div>

      <Alert type="warning" title="Pedagogical Actionable Insights">
        When students demonstrate recurring difficulty on specific topics during diagnostic or summative attempts, the adaptive engine surfaces the root misconceptions so faculty can target intervention.
      </Alert>

      {error && (
        <Alert type="danger" title="Error Loading Learning Gaps">
          {error}
        </Alert>
      )}

      {isLoading ? (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Analyzing student assessment attempts for concept gaps...</span>
          </div>
        </Card>
      ) : gaps.length === 0 ? (
        <Card>
          <EmptyState
            title="No Learning Gaps Detected"
            description="No conceptual gaps have been identified yet. As enrolled students attempt diagnostic pre-tests and summative laboratory assessments, real-time topic weaknesses will automatically populate here."
            icon={<CheckCircle size={36} style={{ color: 'var(--success)' }} />}
          />
        </Card>
      ) : (
        <div className="grid-2">
          {gaps.map((gap, i) => (
            <Card
              key={i}
              title={gap.topic}
              subtitle={`${gap.errorCount} Observed Gap Evidence across ${gap.affectedStudents} Student(s)`}
              headerAction={
                <Badge variant={gap.severity === 'high' ? 'danger' : 'warning'}>
                  {gap.severity === 'high' ? 'High Frequency Gap' : 'Moderate Gap'}
                </Badge>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Identified Root Cause:
                  </span>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: 2 }}>
                    {gap.rootCause}
                  </p>
                </div>

                <div style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--border-accent)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-accent)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Adaptive Engine Remediation:
                  </span>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                    {gap.remedy}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
