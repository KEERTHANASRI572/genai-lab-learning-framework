import React, { useEffect, useState } from 'react';
import { Sliders, Award, Sparkles, CheckCircle2, ArrowRight, BookOpen, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { useApp } from '../../context/AppContext';
import { getAssessmentAttemptById, AssessmentAttemptDto } from '../../services/api';

export const LearningLevelView: React.FC = () => {
  const { setCurrentView, activeAttemptId, setActiveAttemptId, activeExperimentId } = useApp();
  const [attempt, setAttempt] = useState<AssessmentAttemptDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchAttempt() {
      setIsLoading(true);
      setError(null);

      let targetAttemptId = activeAttemptId;

      if (!targetAttemptId) {
        // Try to recover latest attempt from student progress
        try {
          const { getStudentProgress } = await import('../../services/api');
          const progressRes = await getStudentProgress();
          if (progressRes.success && progressRes.data?.attempts?.length) {
            const match = activeExperimentId
              ? progressRes.data.attempts.find(
                  (a: any) => a.experimentId?._id === activeExperimentId || a.experimentId === activeExperimentId
                )
              : progressRes.data.attempts[0];
            const chosen = match || progressRes.data.attempts[0];
            if (chosen?._id) {
              targetAttemptId = chosen._id;
              setActiveAttemptId(chosen._id);
            }
          }
        } catch {
          // Fall through
        }
      }

      if (!targetAttemptId) {
        if (mounted) {
          setIsLoading(false);
          setError('No diagnostic attempt found. Please complete the initial assessment first.');
        }
        return;
      }

      const res = await getAssessmentAttemptById(targetAttemptId);
      if (!mounted) return;
      if (res.success && res.data) {
        setAttempt(res.data);
      } else {
        setError(res.error?.message || 'Failed to retrieve assessment diagnostic result.');
      }
      setIsLoading(false);
    }
    fetchAttempt();
    return () => {
      mounted = false;
    };
  }, [activeAttemptId, activeExperimentId, setActiveAttemptId]);

  const level = attempt?.determinedLearningLevel || 'intermediate';
  const scorePercent = attempt?.scorePercent ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <Badge variant="brand">Step 2 of 5</Badge>
          <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
            Diagnostic Evidence Evaluation
          </span>
        </div>
        <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Topic-Specific Learning Level Determination
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Based on your concept-wise assessment evidence, the framework has calibrated your personalized training environment.
        </p>
      </div>

      {isLoading && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Loading diagnostic evaluation from MongoDB...</span>
          </div>
        </Card>
      )}

      {error && (
        <Alert type="danger" title="Diagnostic Retrieval Warning">
          {error}
        </Alert>
      )}

      {attempt?.facultySupportRecommended && (
        <Alert type="warning" title="Faculty Support Recommended">
          Based on prerequisite gaps identified in this diagnostic, an instructor review request has been flagged. You can consult your instructor directly in the workspace.
        </Alert>
      )}

      {/* Primary Result Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)',
          borderLeft: `4px solid ${level === 'beginner' ? '#38bdf8' : level === 'advanced' ? '#a855f7' : '#fbbf24'}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <Badge level={level}>
              Diagnosed Level: {level.toUpperCase()}
            </Badge>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Diagnostic Score: {scorePercent}% ({attempt?.totalScore ?? 0} / {attempt?.maxScore ?? 0} pts)
            </span>
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {attempt?.recommendedPath || `Calibrated for ${level} Laboratory Training`}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4, maxWidth: 640 }}>
            {attempt?.diagnosisExplanation ||
              'Your procedural workspace has been calibrated with custom scaffolding, hint frequency, and verification checks corresponding to your concept mastery.'}
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          icon={<ArrowRight size={16} />}
          onClick={() => setCurrentView('student-workspace')}
        >
          Enter Laboratory Workspace
        </Button>
      </div>

      {/* Prerequisite & Topic Evidence Card */}
      {attempt?.topicEvidence && attempt.topicEvidence.length > 0 && (
        <Card title="Concept-Wise Performance & Prerequisite Gaps">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              {attempt.topicEvidence.map((t, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: 12,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(15, 23, 42, 0.5)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {t.topicTag}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <span>Correct: {t.questionsCorrect} / {t.questionsAttempted ?? t.questionsTotal ?? 0}</span>
                    {(() => {
                      const score = t.proficiencyScore ?? t.calculatedScore ?? 0;
                      return (
                        <strong style={{ color: score >= 80 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)' }}>
                          {score}%
                        </strong>
                      );
                    })()}
                  </div>
                </div>
              ))}
            </div>

            {attempt.prerequisiteGaps && attempt.prerequisiteGaps.length > 0 && (
              <div style={{ marginTop: 8, padding: 12, borderRadius: 'var(--radius-sm)', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f87171' }}>
                  Identified Prerequisite Gaps to Reinforce:
                </span>
                <ul style={{ margin: '6px 0 0 18px', fontSize: '0.825rem', color: '#fca5a5' }}>
                  {attempt.prerequisiteGaps.map((gap, i) => (
                    <li key={i}>{gap}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Three Distinct Training Paths Display */}
      <div className="grid-3">
        {/* Beginner */}
        <div style={{ borderTop: level === 'beginner' ? '3px solid #38bdf8' : undefined, borderRadius: 'var(--radius-md)' }}>
          <Card
            title="Basic / Beginner Path"
            subtitle="Foundational Scaffolding"
            className={level === 'beginner' ? 'glass-panel' : ''}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div>• <strong>Prerequisite Revision:</strong> Core formulas and safety rules restated before step execution.</div>
              <div>• <strong>Step-by-Step Guidance:</strong> Visual wiring breakdowns and calibration checklists.</div>
              <div>• <strong>Frequent Understanding Checks:</strong> Verification prompts after every single step.</div>
              <div>• <strong>High Hint Assistance:</strong> Proactive troubleshooting prompts on apparatus errors.</div>
            </div>
          </Card>
        </div>

        {/* Intermediate */}
        <div style={{ borderTop: level === 'intermediate' ? '3px solid #fbbf24' : undefined, borderRadius: 'var(--radius-md)' }}>
          <Card
            title="Intermediate Path"
            subtitle="Guided Application"
            className={level === 'intermediate' ? 'glass-panel' : ''}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div>• <strong>Application-Focused:</strong> Direct procedure steps with practical milestone checkpoints.</div>
              <div>• <strong>Guided Experiment Tasks:</strong> Live observation logging tables with tolerance bounds.</div>
              <div>• <strong>Periodic Checkpoints:</strong> Conceptual connections at key operational milestones.</div>
              <div>• <strong>Moderate Scaffolding:</strong> Hints available upon student request.</div>
            </div>
          </Card>
        </div>

        {/* Advanced */}
        <div style={{ borderTop: level === 'advanced' ? '3px solid #a855f7' : undefined, borderRadius: 'var(--radius-md)' }}>
          <Card
            title="Advanced Path"
            subtitle="Independent Synthesis"
            className={level === 'advanced' ? 'glass-panel' : ''}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <div>• <strong>Deeper Technical Analysis:</strong> Parasitic component effects and mathematical modelling.</div>
              <div>• <strong>Independent Problem Solving:</strong> Open parameter sweeps with minimal handholding.</div>
              <div>• <strong>Curriculum Extension Challenges:</strong> Non-linear harmonic distortion synthesis.</div>
              <div>• <strong>Summative Milestones Only:</strong> Autonomous laboratory execution.</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
