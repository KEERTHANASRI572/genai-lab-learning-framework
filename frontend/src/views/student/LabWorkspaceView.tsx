import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  AlertTriangle,
  LifeBuoy,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
  ArrowRight,
  HelpCircle,
  Clock,
  RotateCcw,
  Loader2,
  Check,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { useApp } from '../../context/AppContext';
import {
  getOrCreateSession,
  updateSessionStep,
  queryLabTutor,
  createHelpRequest,
  getExperiments,
  SessionResponseDto,
  LearningSessionDto,
  ExperimentDto,
  ScaffoldingGuidelinesDto,
} from '../../services/api';

interface ChatMessage {
  sender: 'ai' | 'user' | 'system';
  text: string;
  citation?: string;
  safetyNotice?: string;
  time: string;
}

export const LabWorkspaceView: React.FC = () => {
  const { setCurrentView, activeExperimentId, setActiveExperimentId } = useApp();
  const [sessionData, setSessionData] = useState<SessionResponseDto | null>(null);
  const [availableExperiments, setAvailableExperiments] = useState<ExperimentDto[]>([]);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentStepNumber, setCurrentStepNumber] = useState<number>(1);
  const [observationInput, setObservationInput] = useState<string>('');
  const [isSavingStep, setIsSavingStep] = useState(false);
  const [stepNotice, setStepNotice] = useState<string | null>(null);

  const [userQuery, setUserQuery] = useState('');
  const [isQueryingTutor, setIsQueryingTutor] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [helpQueryText, setHelpQueryText] = useState('');
  const [isSubmittingHelp, setIsSubmittingHelp] = useState(false);
  const [helpNotice, setHelpNotice] = useState<string | null>(null);

  const loadSessionForExperiment = async (expId: string) => {
    setIsLoadingSession(true);
    setError(null);
    try {
      const res = await getOrCreateSession(expId);
      if (res.success && res.data) {
        setSessionData(res.data);
        const activeStep = res.data.session.currentStepNumber || 1;
        setCurrentStepNumber(activeStep);
        const existingObs = res.data.session.stepProgress?.find((p) => p.stepNumber === activeStep)?.observationRecorded;
        setObservationInput(existingObs || '');

        const level = res.data.session.assignedScaffoldingLevel;
        setChatMessages([
          {
            sender: 'ai',
            text: `Welcome to ${res.data.experiment.title}. You are calibrated at the ${level.toUpperCase()} training level. I am grounded in your institution's verified laboratory curriculum. Ask any question regarding procedural steps, wiring, or mathematical calibration.`,
            citation: `Institution Verified Curriculum: ${res.data.experiment.code}`,
            time: 'Just now',
          },
        ]);
      } else {
        setError(res.error?.message || 'Failed to initialize persistent laboratory session.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Connection failed';
      setError(`Failed to connect to laboratory session: ${msg}`);
    } finally {
      setIsLoadingSession(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    async function initSession() {
      setIsLoadingSession(true);
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
          setIsLoadingSession(false);
        }
        return;
      }

      if (mounted) {
        await loadSessionForExperiment(expId);
      }
    }
    initSession();
    return () => {
      mounted = false;
    };
  }, [activeExperimentId, setActiveExperimentId]);

  const handleSwitchExperiment = (newExpId: string) => {
    const found = availableExperiments.find((e) => e._id === newExpId);
    if (found) {
      setActiveExperimentId(found._id, found.title, found.code);
      loadSessionForExperiment(found._id);
    }
  };

  const handleStepClick = (stepNum: number) => {
    setCurrentStepNumber(stepNum);
    const step = sessionData?.session.stepProgress?.find((p) => p.stepNumber === stepNum);
    setObservationInput(step?.observationRecorded || '');
    setStepNotice(null);
  };

  const handleSaveStepProgress = async (completed: boolean) => {
    if (!sessionData) return;
    setIsSavingStep(true);
    setStepNotice(null);

    const res = await updateSessionStep(sessionData.session._id, {
      stepNumber: currentStepNumber,
      status: completed ? 'completed' : 'in_progress',
      observationRecorded: observationInput,
      verificationPassed: completed,
      durationSeconds: 30,
    });

    setIsSavingStep(false);

    if (res.success && res.data) {
      setSessionData({
        ...sessionData,
        session: res.data,
      });
      setStepNotice(completed ? `Step ${currentStepNumber} marked as completed!` : 'Observations saved.');
      if (completed && currentStepNumber < (sessionData.experiment.procedureSteps?.length || 1)) {
        setCurrentStepNumber(currentStepNumber + 1);
        const nextStep = res.data.stepProgress.find((p) => p.stepNumber === currentStepNumber + 1);
        setObservationInput(nextStep?.observationRecorded || '');
      }
    } else {
      setError(res.error?.message || 'Failed to persist step observation.');
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim() || !sessionData) return;

    const queryPrompt = userQuery.trim();
    setUserQuery('');

    const newMsg: ChatMessage = {
      sender: 'user',
      text: queryPrompt,
      time: 'Just now',
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setIsQueryingTutor(true);

    const res = await queryLabTutor(sessionData.session._id, {
      studentQuery: queryPrompt,
      stepNumber: currentStepNumber,
    });

    setIsQueryingTutor(false);

    if (res.success && res.data) {
      const citationText = res.data.sourcedReferences?.length
        ? res.data.sourcedReferences.map((r) => r.title).join(', ')
        : 'Approved Institution Courseware';

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'ai',
          text: res.data?.answer || 'Response generated from approved curriculum references.',
          citation: citationText,
          safetyNotice: res.data?.safetyNotice,
          time: 'Just now',
        },
      ]);
    } else {
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'system',
          text: `Service Error: ${res.error?.message || 'The AI lab retrieval assistant is currently unavailable.'}`,
          time: 'Just now',
        },
      ]);
    }
  };

  const handleEscalateToFaculty = async () => {
    if (!sessionData || !helpQueryText.trim()) return;
    setIsSubmittingHelp(true);
    setHelpNotice(null);

    const res = await createHelpRequest({
      experimentId: sessionData.experiment._id,
      learningSessionId: sessionData.session._id,
      stepNumber: currentStepNumber,
      studentQuery: helpQueryText.trim(),
      escalationReason: 'student_requested',
    });

    setIsSubmittingHelp(false);

    if (res.success) {
      setHelpNotice('Help request successfully dispatched to your assigned laboratory faculty.');
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'system',
          text: `Your inquiry for Step ${currentStepNumber} was escalated to faculty. An instructor response will be reviewed in your support queue.`,
          time: 'Just now',
        },
      ]);
      setTimeout(() => {
        setIsHelpModalOpen(false);
        setHelpQueryText('');
      }, 1500);
    } else {
      setError(res.error?.message || 'Failed to submit help request.');
    }
  };

  if (isLoadingSession) {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '30px 0', justifyContent: 'center' }}>
          <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Initializing persistent laboratory workspace and scaffolding...</span>
        </div>
      </Card>
    );
  }

  if (error && !sessionData) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Alert type="warning" title="Session Initialization Notice">
          {error}
        </Alert>

        {availableExperiments.length > 0 && (
          <Card title="Select Curriculum Experiment">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Choose an authorized experiment from your laboratory:
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {availableExperiments.map((e) => (
                <Button
                  key={e._id}
                  variant="primary"
                  size="sm"
                  onClick={() => handleSwitchExperiment(e._id)}
                >
                  {e.code}: {e.title}
                </Button>
              ))}
            </div>
          </Card>
        )}

        <Button variant="outline" onClick={() => setCurrentView('student-experiments')}>
          Back to Experiments
        </Button>
      </div>
    );
  }

  const { experiment, session, scaffolding } = sessionData!;
  const steps = experiment.procedureSteps || [];
  const currentStep = steps.find((s) => s.stepNumber === currentStepNumber) || steps[0] || {
    stepNumber: 1,
    title: 'Laboratory Preparation',
    instructions: 'Review circuit apparatus, calibration, and safety parameters.',
  };

  const level = session.assignedScaffoldingLevel;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Workspace Header */}
      <div
        className="glass-panel"
        style={{
          padding: '14px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Badge variant="brand">{experiment.code}</Badge>
            <Badge level={level}>Path: {level.toUpperCase()}</Badge>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {experiment.title}
            </span>
            {availableExperiments.length > 1 && (
              <select
                className="form-select"
                style={{ fontSize: '0.75rem', padding: '2px 8px', maxWidth: 200 }}
                value={experiment._id}
                onChange={(e) => handleSwitchExperiment(e.target.value)}
              >
                {availableExperiments.map((e) => (
                  <option key={e._id} value={e._id}>
                    {e.code}
                  </option>
                ))}
              </select>
            )}
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
            Step {currentStep.stepNumber} of {steps.length}: {currentStep.title}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <Button
            variant="outline"
            size="sm"
            icon={<LifeBuoy size={14} />}
            onClick={() => setIsHelpModalOpen(true)}
          >
            Escalate to Faculty
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<CheckCircle2 size={14} />}
            onClick={() => setCurrentView('student-final-assessment')}
          >
            Proceed to Final Assessment <ArrowRight size={14} />
          </Button>
        </div>
      </div>

      {stepNotice && (
        <Alert type="success" onClose={() => setStepNotice(null)}>
          {stepNotice}
        </Alert>
      )}

      {/* Step Progression Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-start',
          gap: 8,
          overflowX: 'auto',
        }}
      >
        {steps.map((s) => {
          const isActive = s.stepNumber === currentStepNumber;
          const prog = session.stepProgress?.find((p) => p.stepNumber === s.stepNumber);
          const isDone = prog?.status === 'completed';

          return (
            <button
              key={s.stepNumber}
              onClick={() => handleStepClick(s.stepNumber)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                borderRadius: 'var(--radius-sm)',
                background: isActive ? 'rgba(99, 102, 241, 0.2)' : 'transparent',
                border: isActive ? '1px solid var(--border-focus)' : '1px solid transparent',
                color: isActive ? 'var(--text-accent)' : isDone ? 'var(--success)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: isActive ? 600 : 400,
                whiteSpace: 'nowrap',
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: isDone ? 'var(--success)' : isActive ? 'var(--brand-primary)' : 'rgba(148, 163, 184, 0.2)',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {isDone ? '✓' : s.stepNumber}
              </span>
              <span>{s.title}</span>
            </button>
          );
        })}
      </div>

      {/* Dual Pane Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20 }}>
        {/* LEFT PANE: Instructions & Adaptive Scaffolding */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Active Scaffolding Guidance Banner */}
          <div
            style={{
              padding: '14px 18px',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(15, 23, 42, 0.6)',
              borderLeft: `4px solid ${level === 'beginner' ? '#38bdf8' : level === 'advanced' ? '#a855f7' : '#fbbf24'}`,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {scaffolding.tier} Guidance
              </span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Hint Assistance: <strong>{scaffolding.hintAssistanceLevel}</strong>
              </span>
            </div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: 4, fontWeight: 500 }}>
              {scaffolding.guidance}
            </p>
            <ul style={{ margin: '8px 0 0 16px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {scaffolding.scaffoldingRules?.map((rule, idx) => (
                <li key={idx}>{rule}</li>
              ))}
            </ul>
          </div>

          {/* Procedure Step Instructions */}
          <Card title={`Step ${currentStep.stepNumber}: ${currentStep.title}`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {currentStep.instruction || currentStep.instructions}
              </p>

              {(currentStep.expectedObservation || currentStep.expectedOutcome) && (
                <div style={{ padding: 10, borderRadius: 'var(--radius-sm)', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid var(--border-subtle)', fontSize: '0.825rem' }}>
                  <strong>Expected Observation:</strong> {currentStep.expectedObservation || currentStep.expectedOutcome}
                </div>
              )}

              {experiment.safetyInstructions && experiment.safetyInstructions.length > 0 && (
                <div
                  style={{
                    padding: 12,
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--warning-bg)',
                    border: '1px solid var(--warning-border)',
                    color: '#fcd34d',
                    fontSize: '0.825rem',
                    display: 'flex',
                    gap: 10,
                    alignItems: 'flex-start',
                  }}
                >
                  <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
                  <div>
                    <strong>Safety Precaution:</strong> {experiment.safetyInstructions[0]}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Step Observation Entry & Validation */}
          <Card
            title="Observation & Experimental Measurement Entry"
            subtitle="Record measured apparatus readings and verification notes to persist step completion"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Enter observed apparatus readings (e.g., Measured tau = 1.04 ms, supply V = 5.0 V, oscilloscope rise-time notes)..."
                value={observationInput}
                onChange={(e) => setObservationInput(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isSavingStep}
                  onClick={() => handleSaveStepProgress(false)}
                >
                  Save Draft
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  disabled={isSavingStep || !observationInput.trim()}
                  icon={isSavingStep ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />}
                  onClick={() => handleSaveStepProgress(true)}
                >
                  {isSavingStep ? 'Saving to Database...' : 'Complete Step & Proceed'}
                </Button>
              </div>
            </div>
          </Card>
        </div>

        {/* RIGHT PANE: Grounded AI Tutor */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              flexDirection: 'column',
              height: '620px',
              backgroundColor: '#0a0f1d',
              border: '1px solid var(--border-default)',
            }}
          >
            {/* AI Assistant Header */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(15, 23, 42, 0.6)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={18} style={{ color: 'var(--brand-primary)' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Grounded AI Lab Tutor</div>
                  <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
                    Grounded in Approved Institution Resources
                  </div>
                </div>
              </div>
              <Badge variant="brand">RAG Active</Badge>
            </div>

            {/* Message Stream */}
            <div
              style={{
                flex: 1,
                padding: 16,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {chatMessages.map((msg, idx) => (
                <div
                  key={idx}
                  style={{
                    alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background:
                        msg.sender === 'user'
                          ? 'var(--brand-primary)'
                          : msg.sender === 'system'
                          ? 'var(--warning-bg)'
                          : 'rgba(30, 41, 59, 0.7)',
                      color: msg.sender === 'system' ? '#fcd34d' : '#ffffff',
                      fontSize: '0.85rem',
                      lineHeight: 1.5,
                      whiteSpace: 'pre-wrap',
                      border: msg.sender === 'system' ? '1px solid var(--warning-border)' : '1px solid var(--border-subtle)',
                    }}
                  >
                    {msg.text}
                  </div>
                  {msg.safetyNotice && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 4 }}>
                      <AlertTriangle size={12} />
                      <span>{msg.safetyNotice}</span>
                    </div>
                  )}
                  {msg.citation && (
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        paddingLeft: 4,
                      }}
                    >
                      <BookOpen size={11} />
                      <span>{msg.citation}</span>
                    </div>
                  )}
                </div>
              ))}
              {isQueryingTutor && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  <Loader2 className="animate-spin" size={14} />
                  <span>Searching authorized courseware and generating grounded response...</span>
                </div>
              )}
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSendMessage}
              style={{
                padding: '12px 14px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                gap: 8,
                background: 'rgba(15, 23, 42, 0.5)',
              }}
            >
              <input
                type="text"
                className="form-input"
                placeholder="Ask about this step, circuit wiring, or calculations..."
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                disabled={isQueryingTutor}
                style={{ fontSize: '0.85rem', padding: '8px 12px' }}
              />
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={isQueryingTutor || !userQuery.trim()}
                icon={<Send size={14} />}
              >
                Ask
              </Button>
            </form>
          </div>
        </div>
      </div>

      {/* Escalate to Faculty Modal */}
      {isHelpModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 20,
          }}
        >
          <div
            className="glass-panel"
            style={{
              width: '100%',
              maxWidth: 520,
              padding: 24,
              backgroundColor: '#0f172a',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
            }}
          >
            <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
              Escalate Question to Assigned Faculty
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Your inquiry regarding Step {currentStepNumber} of {experiment.title} will be routed directly to the course instructor.
            </p>

            {helpNotice && (
              <div style={{ marginBottom: 14 }}>
                <Alert type="success">
                  {helpNotice}
                </Alert>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Describe your question or difficulty:
              </label>
              <textarea
                className="form-input"
                rows={4}
                placeholder="Explain the apparatus behavior or calculation issue you are experiencing..."
                value={helpQueryText}
                onChange={(e) => setHelpQueryText(e.target.value)}
                style={{ fontSize: '0.85rem' }}
              />

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <Button variant="outline" onClick={() => setIsHelpModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  disabled={isSubmittingHelp || helpQueryText.trim().length < 5}
                  icon={isSubmittingHelp ? <Loader2 className="animate-spin" size={14} /> : <LifeBuoy size={14} />}
                  onClick={handleEscalateToFaculty}
                >
                  {isSubmittingHelp ? 'Dispatching...' : 'Submit to Faculty Queue'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
