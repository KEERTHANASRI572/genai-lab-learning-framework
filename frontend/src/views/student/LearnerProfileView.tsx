import React, { useEffect, useState } from 'react';
import { User, Award, BookOpen, Clock, TrendingUp, CheckCircle, Sliders, Loader2 } from 'lucide-react';
import { Card, MetricCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { useApp } from '../../context/AppContext';
import { getStudentProgress } from '../../services/api';

export const LearnerProfileView: React.FC = () => {
  const { user, setCurrentView } = useApp();
  const [progressData, setProgressData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      const res = await getStudentProgress();
      if (!mounted) return;
      if (res.success && res.data) {
        setProgressData(res.data);
      }
      setIsLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  if (!user) return null;

  const proficiencies = progressData?.profile?.topicProficiencies || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Profile Header */}
      <div
        className="glass-panel"
        style={{
          padding: '24px 28px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
          borderLeft: '4px solid var(--brand-primary)',
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.75rem',
            fontWeight: 700,
            color: '#fff',
          }}
        >
          {user.name.charAt(0)}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {user.name}
            </h1>
            <Badge variant="brand">Verified Student</Badge>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 2 }}>
            {user.institutionName} · {user.departmentName}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<BookOpen size={14} />}
          onClick={() => setCurrentView('student-experiments')}
        >
          View Assigned Laboratories
        </Button>
      </div>

      <Alert type="info" title="Adaptive Learning Profile Engine">
        Your proficiency levels are <strong>evaluated independently for each topic domain</strong> based on continuous evidence (diagnostic tests, step interaction velocity, observation accuracy, and summative quizzes). Levels are non-permanent and adapt with each lab session.
      </Alert>

      {isLoading && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Loading learner profile from database...</span>
          </div>
        </Card>
      )}

      {/* Dynamic Topic Mastery Matrix */}
      {!isLoading && (
        <Card
          title="Dynamic Topic Mastery Matrix"
          subtitle="Individualized conceptual proficiency trajectory across laboratory topics"
        >
          {proficiencies.length === 0 ? (
            <div style={{ padding: '16px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              No topic assessments recorded yet. Complete an initial diagnostic in the laboratory catalog to build your mastery profile.
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Concept Topic Domain</th>
                    <th>Current Topic Level</th>
                    <th>Confidence Score</th>
                    <th>Last Evaluated</th>
                    <th>Adaptive Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {proficiencies.map((tp: any, idx: number) => (
                    <tr key={idx}>
                      <td><strong>{tp.topicTag}</strong></td>
                      <td>
                        <Badge level={tp.currentLevel}>{tp.currentLevel}</Badge>
                      </td>
                      <td>
                        <strong>{Math.round((tp.confidenceScore || 0) * 100)}%</strong>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(tp.lastAssessedAt).toLocaleString()}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-accent)' }}>
                          {tp.currentLevel === 'beginner'
                            ? 'Step-by-step guidance & prerequisite revision'
                            : tp.currentLevel === 'advanced'
                            ? 'Independent parameter sweep & extension tasks'
                            : 'Guided procedural checkpoints & tolerance verification'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
};
