import React, { useEffect, useState, useCallback } from 'react';
import {
  CheckCircle2,
  Award,
  ArrowRight,
  BookOpen,
  AlertCircle,
  TrendingUp,
  Loader2,
  RefreshCw,
  HelpCircle,
  FlaskConical,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { useApp } from '../../context/AppContext';
import {
  getAssessmentForExperiment,
  submitAssessmentAttempt,
  getExperiments,
  AssessmentDto,
  AssessmentAttemptDto,
  ExperimentDto,
} from '../../services/api';

export const FinalAssessmentView: React.FC = () => {
  const {
    setCurrentView,
    activeExperimentId,
    activeExperimentCode,
    activeExperimentTitle,
    setActiveExperimentId,
    activeCourseId,
    activeSubjectId,
  } = useApp();

  const [assessment, setAssessment] = useState<AssessmentDto | null>(null);
  const [availableExperiments, setAvailableExperiments] = useState<ExperimentDto[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedAttempt, setSubmittedAttempt] = useState<AssessmentAttemptDto | null>(null);
  const [startTime] = useState<number>(Date.now());

  const loadFinalAssessment = useCallback(async (expId: string) => {
    setIsLoading(true);
    setError(null);
    setSelectedAnswers({});
    setSubmittedAttempt(null);

    try {
      const res = await getAssessmentForExperiment(expId, 'final_summative');
      if (res.success && res.data) {
        setAssessment(res.data);
      } else {
        setAssessment(null);
        setError(
          res.error?.message ||
            'Final assessment is not yet available. Please check again when your faculty publishes it.'
        );
      }
    } catch (err: unknown) {
      setAssessment(null);
      const msg = err instanceof Error ? err.message : 'Connection error';
      setError(`Failed to retrieve final assessment: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    async function initialize() {
      setIsLoading(true);
      setError(null);

      // Load published experiments
      let exps: ExperimentDto[] = [];
      try {
        const expList = await getExperiments({ status: 'published' });
        if (mounted && expList.success && expList.data) {
          exps = expList.data;
          setAvailableExperiments(exps);
        }
      } catch {
        // Continue
      }

      let expId = activeExperimentId;
      if (!expId && exps.length > 0) {
        expId = exps[0]._id;
        setActiveExperimentId(expId, exps[0].title, exps[0].code);
      }

      if (!expId) {
        if (mounted) {
          setError('No experiment selected. Please select an authorized experiment from your curriculum.');
          setIsLoading(false);
        }
        return;
      }

      if (mounted) {
        await loadFinalAssessment(expId);
      }
    }

    initialize();
    return () => {
      mounted = false;
    };
  }, [activeExperimentId, setActiveExperimentId, loadFinalAssessment]);

  const handleExperimentSelect = (newExpId: string) => {
    const found = availableExperiments.find((e) => e._id === newExpId);
    if (found) {
      setActiveExperimentId(found._id, found.title, found.code);
      loadFinalAssessment(found._id);
    }
  };

  const handleSelectOption = (questionId: string, optionId: string) => {
    setSelectedAnswers((prev) => ({ ...prev, [questionId]: optionId }));
  };

  const questions = assessment?.questions || [];
  const allAnswered = questions.length > 0 && questions.every((q) => selectedAnswers[q.questionId]);

  const handleSubmit = async () => {
    if (!assessment) return;
    setIsSubmitting(true);
    setError(null);

    const answersPayload = Object.entries(selectedAnswers).map(([questionId, selectedOptionId]) => ({
      questionId,
      selectedOptionId,
    }));

    const durationSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

    try {
      const res = await submitAssessmentAttempt(assessment._id, {
        answers: answersPayload,
        durationSeconds,
        subjectId: activeSubjectId || undefined,
        courseId: activeCourseId || undefined,
      });

      setIsSubmitting(false);

      if (res.success && res.data) {
        setSubmittedAttempt(res.data);
      } else {
        setError(res.error?.message || 'Failed to submit final assessment. Please try again.');
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(`Failed to submit final assessment: ${msg}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <Badge variant="brand">Step 4 of 5</Badge>
            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              {activeExperimentCode ? `${activeExperimentCode}: ${activeExperimentTitle}` : 'Final Summative Assessment'}
            </span>
            {assessment?.timeLimitMins && (
              <Badge variant="neutral">Time Limit: {assessment.timeLimitMins} mins</Badge>
            )}
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Final Summative Assessment &amp; Analysis
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Validate your procedural comprehension and analytical observations against theoretical benchmarks.
          </p>
        </div>

        {/* Experiment Selector if multiple exist */}
        {availableExperiments.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Experiment:
            </label>
            <select
              className="form-select"
              style={{ minWidth: 240, fontSize: '0.85rem' }}
              value={activeExperimentId || ''}
              onChange={(e) => handleExperimentSelect(e.target.value)}
            >
              {availableExperiments.map((e) => (
                <option key={e._id} value={e._id}>
                  {e.code} — {e.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '30px 0', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--brand-primary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Querying published final assessment from MongoDB...</span>
          </div>
        </Card>
      )}

      {/* Unavailable State: Faculty has not yet published final assessment */}
      {!isLoading && !submittedAttempt && (!assessment || questions.length === 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert type="info" title="Final Assessment Notice">
            Final assessment is not yet available. Please check again when your faculty publishes it.
          </Alert>

          <Card title="Assessment Status">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              The summative assessment for <strong>{activeExperimentTitle || 'this experiment'}</strong> is currently being authored or reviewed by your assigned course faculty.
            </p>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button
                variant="primary"
                icon={<FlaskConical size={16} />}
                onClick={() => setCurrentView('student-workspace')}
              >
                Return to Interactive Lab Workspace
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentView('student-experiments')}
              >
                Experiment Catalog
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentView('student-profile')}
              >
                View Learner Profile
              </Button>
            </div>
          </Card>
        </div>
      )}

      {error && !isLoading && assessment && (
        <Alert type="danger" title="Assessment Notice">
          {error}
        </Alert>
      )}

      {/* Active Question Form: Real questions from backend */}
      {!isLoading && !submittedAttempt && assessment && questions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {questions.map((q, idx) => (
            <Card key={q.questionId} title={`Question ${idx + 1}: ${q.topicTag || 'Summative Concept'}`}>
              <p style={{ fontSize: '0.95rem', fontWeight: 500, color: 'var(--text-primary)', marginBottom: 14 }}>
                {q.prompt}
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map((opt) => {
                  const isSelected = selectedAnswers[q.questionId] === opt.optionId;
                  return (
                    <div
                      key={opt.optionId}
                      onClick={() => handleSelectOption(q.questionId, opt.optionId)}
                      style={{
                        padding: '12px 16px',
                        borderRadius: 'var(--radius-sm)',
                        background: isSelected ? 'rgba(99, 102, 241, 0.2)' : 'rgba(15, 23, 42, 0.5)',
                        border: isSelected ? '1px solid var(--border-focus)' : '1px solid var(--border-subtle)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: isSelected ? '5px solid var(--primary)' : '2px solid var(--text-muted)',
                          background: isSelected ? '#fff' : 'transparent',
                        }}
                      />
                      <span style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>{opt.text}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
            <Button variant="outline" onClick={() => setCurrentView('student-workspace')}>
              Back to Lab Workspace
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={!allAnswered || isSubmitting}
              icon={isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Evaluating Final Assessment...' : 'Submit Final Assessment'}
            </Button>
          </div>
        </div>
      )}

      {/* Real Submitted Results View: Grounded in MongoDB Evaluated Attempt */}
      {submittedAttempt && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div
            className="glass-panel"
            style={{
              padding: '24px 28px',
              background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.95) 100%)',
              borderLeft: `4px solid ${
                submittedAttempt.scorePercent >= 70 ? 'var(--success)' : 'var(--warning)'
              }`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Badge variant={submittedAttempt.scorePercent >= 70 ? 'success' : 'neutral'} dot>
                  Score: {submittedAttempt.scorePercent}% ({submittedAttempt.totalScore} / {submittedAttempt.maxScore} pts)
                </Badge>
                <Badge level={submittedAttempt.determinedLearningLevel || 'intermediate'}>
                  Mastery: {(submittedAttempt.determinedLearningLevel || 'intermediate').toUpperCase()}
                </Badge>
              </div>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {submittedAttempt.scorePercent >= 70
                  ? 'Demonstrated Comprehensive Analytical Mastery'
                  : 'Summative Evaluation Completed'}
              </h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                {submittedAttempt.diagnosisExplanation ||
                  'Your experimental observation data and summative evaluation have been recorded in MongoDB.'}
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              icon={<ArrowRight size={16} />}
              onClick={() => setCurrentView('student-profile')}
            >
              View Updated Learner Profile
            </Button>
          </div>

          {/* Real Topic-Wise Breakdown */}
          {(() => {
            const evidenceList = submittedAttempt.topicProficiencyEvidence || submittedAttempt.topicEvidence || [];
            if (evidenceList.length === 0) return null;

            return (
              <Card title="Concept-Wise Evaluation Breakdown">
                <div className="table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Evaluated Concept Topic</th>
                        <th>Correct / Total</th>
                        <th>Mastery Score</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evidenceList.map((t, idx: number) => {
                        const correct = t.questionsCorrect ?? 0;
                        const total = t.questionsTotal ?? t.questionsAttempted ?? 0;
                        const score = t.calculatedScore ?? t.proficiencyScore ?? (total > 0 ? Math.round((correct / total) * 100) : 0);

                        return (
                          <tr key={idx}>
                            <td>{t.topicTag}</td>
                            <td>
                              {correct} / {total}
                            </td>
                            <td>
                              <strong>{score}%</strong>
                            </td>
                            <td>
                              <Badge variant={score >= 70 ? 'success' : 'neutral'}>
                                {score >= 80 ? 'Mastered' : score >= 60 ? 'Proficient' : 'Review Needed'}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })()}
        </div>
      )}
    </div>
  );
};
