import React, { useEffect, useState, useCallback } from 'react';
import { ClipboardCheck, ArrowRight, HelpCircle, CheckCircle, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
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
  ExperimentDto,
} from '../../services/api';

export const InitialAssessmentView: React.FC = () => {
  const {
    setCurrentView,
    activeExperimentId,
    activeExperimentTitle,
    activeExperimentCode,
    setActiveExperimentId,
    setActiveAttemptId,
    activeSubjectId,
    activeCourseId,
  } = useApp();

  const [assessment, setAssessment] = useState<AssessmentDto | null>(null);
  const [availableExperiments, setAvailableExperiments] = useState<ExperimentDto[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [startTime] = useState<number>(Date.now());

  const loadAssessmentForExperiment = useCallback(
    async (expId: string) => {
      setIsLoading(true);
      setError(null);
      setSelectedAnswers({});

      try {
        const res = await getAssessmentForExperiment(expId, 'initial_diagnostic');
        if (res.success && res.data) {
          setAssessment(res.data);
        } else {
          setAssessment(null);
          setError(
            res.error?.message ||
              'No published initial diagnostic assessment has been configured for this experiment yet. Please contact your course faculty.'
          );
        }
      } catch (err: unknown) {
        setAssessment(null);
        const msg = err instanceof Error ? err.message : 'Connection failed.';
        setError(`Failed to retrieve diagnostic assessment: ${msg}`);
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

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
        await loadAssessmentForExperiment(expId);
      }
    }

    initialize();
    return () => {
      mounted = false;
    };
  }, [activeExperimentId, setActiveExperimentId, loadAssessmentForExperiment]);

  const handleExperimentSelect = (newExpId: string) => {
    const found = availableExperiments.find((e) => e._id === newExpId);
    if (found) {
      setActiveExperimentId(found._id, found.title, found.code);
      loadAssessmentForExperiment(found._id);
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
        const attemptId = res.data._id || (res.data as any).attemptId;
        setActiveAttemptId(attemptId);
        setCurrentView('student-learning-level');
      } else {
        setError(res.error?.message || 'Failed to submit diagnostic attempt. Please check your connection.');
      }
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : 'Network error';
      setError(`Failed to submit diagnostic assessment: ${msg}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header and Step Information */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
            <Badge variant="brand">Step 1 of 5</Badge>
            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              {activeExperimentCode ? `${activeExperimentCode}: ${activeExperimentTitle}` : 'Diagnostic Concept Assessment'}
            </span>
            {assessment?.timeLimitMins && (
              <Badge variant="neutral">Time Limit: {assessment.timeLimitMins} mins</Badge>
            )}
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Initial Diagnostic Concept Assessment
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            This pre-lab diagnostic assesses your topic-specific prerequisite mastery to calibrate scaffolding and hints in your interactive lab workspace.
          </p>
        </div>

        {/* In-view Experiment Selector if multiple exist */}
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

      <Alert type="info" title="Dynamic Personalization Notice">
        <strong>Explainable Evidence-Based Diagnosis:</strong> Your learning level is determined by topic mastery and prerequisite readiness, stored securely in MongoDB, and used to generate your personalized training path.
      </Alert>

      {isLoading && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '30px 0', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--brand-primary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Retrieving diagnostic questions from MongoDB Atlas...</span>
          </div>
        </Card>
      )}

      {error && !isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Alert type="warning" title="Diagnostic Assessment Notice">
            {error}
          </Alert>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button variant="outline" onClick={() => setCurrentView('student-experiments')}>
              Back to Experiment Catalog
            </Button>
            {activeExperimentId && (
              <Button
                variant="primary"
                onClick={() => loadAssessmentForExperiment(activeExperimentId)}
                icon={<RefreshCw size={14} />}
              >
                Retry
              </Button>
            )}
          </div>
        </div>
      )}

      {!isLoading && assessment && questions.length > 0 && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {questions.map((q, idx) => (
              <Card key={q.questionId} title={`Question ${idx + 1}: ${q.topicTag || 'Core Concept'}`}>
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
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
            <Button variant="outline" onClick={() => setCurrentView('student-experiment-overview')}>
              Back to Overview
            </Button>
            <Button
              variant="primary"
              size="lg"
              disabled={!allAnswered || isSubmitting}
              icon={isSubmitting ? <Loader2 className="animate-spin" size={16} /> : <ArrowRight size={16} />}
              onClick={handleSubmit}
            >
              {isSubmitting ? 'Evaluating Diagnostic in MongoDB...' : 'Submit Diagnostic Assessment'}
            </Button>
          </div>
        </>
      )}

      {!isLoading && assessment && questions.length === 0 && (
        <Card>
          <div style={{ padding: '24px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              No Questions Configured
            </h3>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: 16 }}>
              No diagnostic assessment questions have been configured for this experiment yet. Please contact your course faculty.
            </p>
            <Button variant="outline" onClick={() => setCurrentView('student-experiments')}>
              Return to Catalog
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};
