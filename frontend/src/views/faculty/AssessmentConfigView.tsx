import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Plus,
  CheckCircle,
  CheckCircle2,
  XCircle,
  BookOpen,
  Edit2,
  Trash2,
  AlertTriangle,
  Loader2,
  X,
  FlaskConical,
  HelpCircle,
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Sliders,
  Send,
  RotateCcw,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Tabs } from '../../components/common/Tabs';
import { Alert } from '../../components/common/Alert';
import { FormField } from '../../components/common/FormField';
import { EmptyState } from '../../components/common/EmptyState';
import { useApp } from '../../context/AppContext';
import {
  getExperiments,
  getAssessmentForExperiment,
  createAssessment,
  updateAssessment,
  addAssessmentQuestion,
  updateAssessmentQuestion,
  deleteAssessmentQuestion,
  updateAssessmentQuestionStatus,
  approveAllDraftQuestions,
  generateQuestionsFromResource,
  listLearningResources,
  ExperimentDto,
  AssessmentDto,
  AssessmentQuestionDto,
  AssessmentOptionDto,
  LearningResourceDto,
} from '../../services/api';

type QuestionFilter = 'all' | 'draft' | 'approved' | 'rejected';

export const AssessmentConfigView: React.FC = () => {
  const { activeExperimentId, setActiveExperimentId } = useApp();
  const [activeTab, setActiveTab] = useState<'initial' | 'final' | 'rubrics'>('initial');

  // Experiments list
  const [experiments, setExperiments] = useState<ExperimentDto[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string>('');

  // Assessment & Questions state
  const [assessment, setAssessment] = useState<AssessmentDto | null>(null);
  const [loadingExps, setLoadingExps] = useState(true);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Question review filtering
  const [questionFilter, setQuestionFilter] = useState<QuestionFilter>('all');
  const [expandedPassageIds, setExpandedPassageIds] = useState<Record<string, boolean>>({});
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Question Form Modal State (Add & Edit)
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  const [prompt, setPrompt] = useState('');
  const [topicTag, setTopicTag] = useState('');
  const [optA, setOptA] = useState('');
  const [optB, setOptB] = useState('');
  const [optC, setOptC] = useState('');
  const [optD, setOptD] = useState('');
  const [correctOpt, setCorrectOpt] = useState('opt_a');
  const [weight, setWeight] = useState('10');
  const [difficulty, setDifficulty] = useState<'beginner' | 'intermediate' | 'advanced'>('intermediate');
  const [explanation, setExplanation] = useState('');

  // RAG Generation Modal State
  const [showRagModal, setShowRagModal] = useState(false);
  const [learningResources, setLearningResources] = useState<LearningResourceDto[]>([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [selectedResourceId, setSelectedResourceId] = useState('');
  const [ragCount, setRagCount] = useState<number>(5);
  const [ragDifficulty, setRagDifficulty] = useState<'all' | 'beginner' | 'intermediate' | 'advanced'>('all');
  const [ragTopicFocus, setRagTopicFocus] = useState('');
  const [isGeneratingRag, setIsGeneratingRag] = useState(false);

  // Bulk Approve Confirmation Modal State
  const [showBulkApproveConfirm, setShowBulkApproveConfirm] = useState(false);
  const [isBulkApproving, setIsBulkApproving] = useState(false);

  // Settings & Publish Modal State
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [passPercent, setPassPercent] = useState<number>(60);
  const [timeLimit, setTimeLimit] = useState<number>(20);
  const [isPublishing, setIsPublishing] = useState(false);

  // Delete question confirmation
  const [deletingQuestion, setDeletingQuestion] = useState<AssessmentQuestionDto | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load experiments on mount
  useEffect(() => {
    async function loadInitial() {
      setLoadingExps(true);
      setError(null);
      try {
        const res = await getExperiments();
        if (res.success && res.data) {
          setExperiments(res.data);
          if (res.data.length > 0) {
            const initialId =
              activeExperimentId && res.data.some((e) => e._id === activeExperimentId)
                ? activeExperimentId
                : res.data[0]._id;
            setSelectedExpId(initialId);
          }
        } else {
          setError(res.error?.message || 'Failed to load authorized laboratory experiments.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Error fetching experiments.');
      } finally {
        setLoadingExps(false);
      }
    }
    loadInitial();
  }, [activeExperimentId]);

  // Load assessment whenever selected experiment or tab changes
  const loadAssessment = async () => {
    if (!selectedExpId) {
      setAssessment(null);
      return;
    }
    setLoadingAssessment(true);
    setError(null);
    const assessmentType = activeTab === 'final' ? 'final_summative' : 'initial_diagnostic';
    try {
      const res = await getAssessmentForExperiment(selectedExpId, assessmentType);
      if (res.success && res.data) {
        setAssessment(res.data);
        setPassPercent(res.data.passingScorePercent || 60);
        setTimeLimit(res.data.timeLimitMins || 20);
      } else {
        setAssessment(null);
      }
    } catch {
      setAssessment(null);
    } finally {
      setLoadingAssessment(false);
    }
  };

  useEffect(() => {
    loadAssessment();
  }, [selectedExpId, activeTab]);

  const handleExperimentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newId = e.target.value;
    setSelectedExpId(newId);
    setActiveExperimentId(newId);
  };

  const handleCreateAssessment = async () => {
    if (!selectedExpId) return;
    setSaving(true);
    setError(null);
    const selectedExp = experiments.find((e) => e._id === selectedExpId);
    const assessmentType = activeTab === 'final' ? 'final_summative' : 'initial_diagnostic';
    const typeLabel = activeTab === 'final' ? 'Final Summative Evaluation' : 'Pre-Lab Diagnostic Quiz';

    try {
      const res = await createAssessment({
        experimentId: selectedExpId,
        type: assessmentType,
        title: `${selectedExp?.code || 'EXP'} — ${typeLabel}`,
        description: `Evidence-driven ${typeLabel} evaluating topic prerequisite mastery.`,
        passingScorePercent: 60,
        timeLimitMins: 20,
        questions: [],
        status: 'draft',
      });

      if (res.success && res.data) {
        setAssessment(res.data);
        setNotice(`Created assessment draft for "${selectedExp?.title}". You can now generate questions via RAG or add them manually.`);
      } else {
        setError(res.error?.message || 'Failed to initialize assessment.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error creating assessment.');
    } finally {
      setSaving(false);
    }
  };

  // Open RAG Generator Modal
  const openRagModal = async () => {
    setShowRagModal(true);
    setLoadingResources(true);
    setError(null);
    try {
      const res = await listLearningResources();
      if (res.success && res.data) {
        // Only allow documents with vector indexing completed
        const indexedDocs = res.data.filter((r) => r.ragIndexingStatus === 'ready');
        setLearningResources(indexedDocs);
        if (indexedDocs.length > 0) {
          setSelectedResourceId(indexedDocs[0]._id);
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to fetch indexed resources.');
    } finally {
      setLoadingResources(false);
    }
  };

  // RAG Generation Submit Handler
  const handleGenerateRagQuestions = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpId || !selectedResourceId) return;

    setIsGeneratingRag(true);
    setError(null);
    setNotice(null);

    const targetType = activeTab === 'final' ? 'final_summative' : 'initial_diagnostic';

    try {
      const res = await generateQuestionsFromResource({
        resourceId: selectedResourceId,
        experimentId: selectedExpId,
        type: targetType,
        count: ragCount,
        difficulty: ragDifficulty,
        topicFocus: ragTopicFocus.trim() || undefined,
      });

      if (res.success && res.data) {
        // Guarantee user is on question list tab (not rubrics) so question cards are immediately visible
        setActiveTab(targetType === 'final_summative' ? 'final' : 'initial');
        setAssessment(res.data.assessment);
        setShowRagModal(false);
        // Set filter to 'draft' or 'all' so generated draft items are rendered immediately
        setQuestionFilter('draft');
        setNotice(
          `Successfully generated ${res.data.generatedQuestions.length} draft question(s) strictly grounded in "${res.data.resource.title}". Please review, edit, approve, or reject each question below.`
        );
        // Refresh from backend to ensure full synchronization with Atlas
        loadAssessment();
      } else {
        setError(res.error?.message || 'Failed to generate questions from document.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error during RAG question synthesis.');
    } finally {
      setIsGeneratingRag(false);
    }
  };

  // Review Status Update (Approve / Reject / Restore to Draft)
  const handleUpdateStatus = async (questionId: string, newStatus: 'draft' | 'approved' | 'rejected') => {
    if (!assessment) return;
    setUpdatingStatusId(questionId);
    setError(null);
    setNotice(null);
    try {
      const res = await updateAssessmentQuestionStatus(assessment._id, questionId, newStatus);
      if (res.success && res.data) {
        setAssessment(res.data.assessment);
        const actionLabel =
          newStatus === 'approved'
            ? 'Question approved successfully and added to active assessment.'
            : newStatus === 'rejected'
            ? 'Question rejected and moved to Rejected list.'
            : 'Question returned to Draft review queue.';
        setNotice(actionLabel);
      } else {
        setError(res.error?.message || 'Failed to update question review status.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating question status.');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Bulk Approve Drafts with Confirmation
  const handleConfirmBulkApprove = async () => {
    if (!assessment) return;
    setIsBulkApproving(true);
    setError(null);
    try {
      const res = await approveAllDraftQuestions(assessment._id);
      if (res.success && res.data) {
        setAssessment(res.data);
        setShowBulkApproveConfirm(false);
        setNotice('All pending draft questions have been approved successfully.');
        setQuestionFilter('approved');
      } else {
        setError(res.error?.message || 'Failed to approve draft questions in bulk.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error during bulk approval.');
    } finally {
      setIsBulkApproving(false);
    }
  };

  // Publish / Unpublish Assessment
  const handleTogglePublish = async (targetStatus: 'published' | 'draft') => {
    if (!assessment) return;

    if (targetStatus === 'published') {
      const approvedItems = (assessment.questions || []).filter(
        (q) => (q.status === 'approved' || !q.status) && !q.isArchived
      );
      if (approvedItems.length === 0) {
        setError('Cannot publish assessment without at least one approved question. Please review and approve draft questions first.');
        return;
      }
    }

    setIsPublishing(true);
    setError(null);
    try {
      const res = await updateAssessment(assessment._id, {
        status: targetStatus,
        passingScorePercent: passPercent,
        timeLimitMins: timeLimit,
      });

      if (res.success && res.data) {
        setAssessment(res.data);
        setShowSettingsModal(false);
        setNotice(
          targetStatus === 'published'
            ? 'Assessment published successfully! Students can now take this assessment.'
            : 'Assessment reverted to draft mode. It is now hidden from students.'
        );
      } else {
        setError(res.error?.message || 'Failed to update assessment status.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error updating assessment.');
    } finally {
      setIsPublishing(false);
    }
  };

  const openAddQuestionModal = () => {
    setIsEditing(false);
    setEditingQuestionId(null);
    setPrompt('');
    setTopicTag('');
    setOptA('');
    setOptB('');
    setOptC('');
    setOptD('');
    setCorrectOpt('opt_a');
    setWeight('10');
    setDifficulty('intermediate');
    setExplanation('');
    setShowQuestionModal(true);
  };

  const openEditQuestionModal = (q: AssessmentQuestionDto) => {
    setIsEditing(true);
    setEditingQuestionId(q.questionId);
    setPrompt(q.prompt);
    setTopicTag(q.topicTag);
    setOptA(q.options[0]?.text || '');
    setOptB(q.options[1]?.text || '');
    setOptC(q.options[2]?.text || '');
    setOptD(q.options[3]?.text || '');

    // Map correctOptionId to modal's radio value (opt_a, opt_b, opt_c, opt_d)
    const correctIdx = q.options.findIndex((o) => o.optionId === q.correctOptionId);
    setCorrectOpt(
      correctIdx === 1 ? 'opt_b' : correctIdx === 2 ? 'opt_c' : correctIdx === 3 ? 'opt_d' : 'opt_a'
    );

    setWeight(String(q.weight || 10));
    setDifficulty(q.difficulty || 'intermediate');
    setExplanation(q.explanation || '');
    setShowQuestionModal(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assessment) return;

    if (!prompt.trim()) {
      setError('Question prompt is required.');
      return;
    }
    if (!topicTag.trim()) {
      setError('Topic Tag is required for evidence mapping.');
      return;
    }
    if (!optA.trim() || !optB.trim()) {
      setError('At least Option A and Option B must be provided.');
      return;
    }

    const options: AssessmentOptionDto[] = [
      { optionId: 'opt_a', text: optA.trim() },
      { optionId: 'opt_b', text: optB.trim() },
    ];
    if (optC.trim()) options.push({ optionId: 'opt_c', text: optC.trim() });
    if (optD.trim()) options.push({ optionId: 'opt_d', text: optD.trim() });

    setSaving(true);
    setError(null);
    setNotice(null);

    const payload = {
      prompt: prompt.trim(),
      topicTag: topicTag.trim(),
      options,
      correctOptionId: correctOpt,
      explanation: explanation.trim() || undefined,
      difficulty,
      weight: Number(weight) || 10,
    };

    try {
      if (isEditing && editingQuestionId) {
        const res = await updateAssessmentQuestion(assessment._id, editingQuestionId, payload);
        if (res.success && res.data) {
          setAssessment(res.data);
          setNotice('Question updated successfully while preserving grounded source references.');
          setShowQuestionModal(false);
        } else {
          setError(res.error?.message || 'Failed to update question.');
        }
      } else {
        const res = await addAssessmentQuestion(assessment._id, payload);
        if (res.success && res.data) {
          setAssessment(res.data);
          setNotice('New faculty-created question added successfully.');
          setShowQuestionModal(false);
        } else {
          setError(res.error?.message || 'Failed to add question.');
        }
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error saving question.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuestion = async () => {
    if (!assessment || !deletingQuestion) return;
    setIsDeleting(true);
    setError(null);
    try {
      const res = await deleteAssessmentQuestion(assessment._id, deletingQuestion.questionId);
      if (res.success && res.data) {
        setAssessment(res.data);
        setNotice('Question removed or archived successfully to protect historical student attempts.');
        setDeletingQuestion(null);
      } else {
        setError(res.error?.message || 'Failed to delete question.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error deleting question.');
    } finally {
      setIsDeleting(false);
    }
  };

  const togglePassage = (qId: string) => {
    setExpandedPassageIds((prev) => ({
      ...prev,
      [qId]: !prev[qId],
    }));
  };

  const rawQuestions = assessment?.questions || [];
  const activeQuestions = rawQuestions.filter((q) => !q.isArchived);

  // Live Counts for filters
  const draftCount = activeQuestions.filter((q) => q.status === 'draft').length;
  const approvedCount = activeQuestions.filter((q) => q.status === 'approved' || !q.status).length;
  const rejectedCount = activeQuestions.filter((q) => q.status === 'rejected').length;

  const filteredQuestions = activeQuestions.filter((q) => {
    if (questionFilter === 'draft') return q.status === 'draft';
    if (questionFilter === 'approved') return q.status === 'approved' || !q.status;
    if (questionFilter === 'rejected') return q.status === 'rejected';
    return true;
  });

  const selectedExp = experiments.find((e) => e._id === selectedExpId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Assessment & Rubric Configuration
            </h1>
            {assessment && (
              <Badge variant={assessment.status === 'published' ? 'success' : 'warning'}>
                {assessment.status === 'published' ? 'Published' : 'Draft Mode'}
              </Badge>
            )}
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Configure experiment-linked diagnostic assessments, verify grounded RAG questions, and manage evaluation rubrics.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Button
            variant="outline"
            icon={<Sparkles size={16} style={{ color: 'var(--brand-primary)' }} />}
            onClick={openRagModal}
            disabled={!selectedExpId}
          >
            Generate with AI (RAG)
          </Button>
          {assessment && (
            <>
              <Button variant="primary" icon={<Plus size={16} />} onClick={openAddQuestionModal}>
                Add Question
              </Button>
              <Button
                variant={assessment.status === 'published' ? 'outline' : 'primary'}
                icon={<Sliders size={16} />}
                onClick={() => setShowSettingsModal(true)}
              >
                {assessment.status === 'published' ? 'Settings & Publish' : 'Publish Assessment'}
              </Button>
            </>
          )}
        </div>
      </div>

      {notice && (
        <Alert type="success" title="Success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error && (
        <Alert type="danger" title="Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Experiment Selector Bar */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--brand-primary)', fontWeight: 600 }}>
            <FlaskConical size={18} />
            <span>Target Laboratory Experiment:</span>
          </div>
          {loadingExps ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 className="animate-spin" size={16} />
              <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading authorized experiments...</span>
            </div>
          ) : experiments.length === 0 ? (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
              No laboratory experiments found for your institution.
            </span>
          ) : (
            <select
              className="form-input"
              value={selectedExpId}
              onChange={handleExperimentChange}
              style={{ maxWidth: 460, fontWeight: 500 }}
            >
              {experiments.map((exp) => (
                <option key={exp._id} value={exp._id}>
                  {exp.code ? `[${exp.code}] ` : ''}{exp.title}
                </option>
              ))}
            </select>
          )}
        </div>
      </Card>

      <Alert type="info" title="RAG-Based Grounded Learning Integration">
        Assessment questions generated from uploaded learning documents are strictly grounded in verified course materials. Generated questions remain in <strong>Draft status</strong> until reviewed and approved by faculty before publishing to students.
      </Alert>

      {/* Assessment Type Tabs */}
      <Tabs
        tabs={[
          {
            id: 'initial',
            label: 'Initial Diagnostic Assessment',
            count: activeTab === 'initial' ? activeQuestions.length : undefined,
          },
          {
            id: 'final',
            label: 'Final Summative Assessment',
            count: activeTab === 'final' ? activeQuestions.length : undefined,
          },
          {
            id: 'rubrics',
            label: 'Mastery Rubrics & Topic Map',
            count: activeQuestions.length,
          },
        ]}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as 'initial' | 'final' | 'rubrics')}
      />

      {loadingAssessment ? (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 0' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--brand-primary)' }} />
            <span style={{ marginLeft: 10, color: 'var(--text-secondary)' }}>Loading experiment assessment from database...</span>
          </div>
        </Card>
      ) : !assessment ? (
        <Card>
          <EmptyState
            title={`No ${activeTab === 'final' ? 'Final Summative' : 'Diagnostic'} Assessment Configured`}
            description={`No assessment is currently linked to "${selectedExp?.title || 'the selected experiment'}". You can initialize a draft assessment or generate questions directly from approved documents using AI (RAG).`}
            icon={<ClipboardCheck size={32} />}
            actionLabel={saving ? 'Initializing Assessment...' : 'Create Assessment Draft'}
            onAction={handleCreateAssessment}
          />
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: -12, marginBottom: 20 }}>
            <Button
              variant="outline"
              icon={<Sparkles size={16} style={{ color: 'var(--brand-primary)' }} />}
              onClick={openRagModal}
              disabled={!selectedExpId}
            >
              Or Generate Directly with AI (RAG)
            </Button>
          </div>
        </Card>
      ) : activeTab === 'rubrics' ? (
        /* Rubrics & Topic Map Tab */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {draftCount > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.35)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={18} style={{ color: '#fbbf24' }} />
                <span style={{ fontSize: '0.875rem', color: '#fbbf24', fontWeight: 500 }}>
                  You have <strong>{draftCount}</strong> draft question(s) awaiting review and approval before they can be included in the active rubric.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setActiveTab('initial');
                  setQuestionFilter('draft');
                }}
              >
                Review Draft Questions
              </Button>
            </div>
          )}

          <Card
            title={`Mastery Rubric: ${selectedExp?.title || 'Experiment'}`}
            subtitle="Topic weight distribution and cognitive assessment matrix derived from approved questions"
            headerAction={
              <Button variant="outline" size="sm" icon={<Plus size={14} />} onClick={openAddQuestionModal}>
                Add Rubric Question
              </Button>
            }
          >
            {activeQuestions.length === 0 ? (
              <EmptyState
                title="No Questions Configured in Rubric"
                description="Add or generate questions to define the assessment rubrics for this experiment."
                icon={<ClipboardCheck size={28} />}
                actionLabel="Generate with AI (RAG)"
                onAction={openRagModal}
              />
            ) : (
              <div className="table-container">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Topic Domain</th>
                      <th>Origin</th>
                      <th>Review Status</th>
                      <th>Difficulty</th>
                      <th>Marks Weight</th>
                      <th>Pass Target</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeQuestions.map((q, idx) => (
                      <tr key={q.questionId || idx}>
                        <td>
                          <strong>{q.topicTag}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {q.prompt.length > 70 ? `${q.prompt.substring(0, 70)}...` : q.prompt}
                          </div>
                        </td>
                        <td>
                          <Badge variant={q.sourceType === 'ai_generated' ? 'brand' : 'neutral'}>
                            {q.sourceType === 'ai_generated' ? 'AI Grounded' : 'Faculty Created'}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            variant={
                              q.status === 'approved' || !q.status
                                ? 'success'
                                : q.status === 'draft'
                                ? 'warning'
                                : 'danger'
                            }
                          >
                            {(q.status || 'approved').toUpperCase()}
                          </Badge>
                        </td>
                        <td>
                          <Badge
                            variant={
                              q.difficulty === 'beginner'
                                ? 'neutral'
                                : q.difficulty === 'advanced'
                                ? 'brand'
                                : 'warning'
                            }
                          >
                            {q.difficulty?.toUpperCase()}
                          </Badge>
                        </td>
                        <td>{q.weight || 10} Marks</td>
                        <td>{assessment.passingScorePercent || 60}%</td>
                        <td>
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Edit2 size={13} />}
                            onClick={() => openEditQuestionModal(q)}
                          >
                            Edit
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
      ) : (
        /* Questions Listing (Initial Diagnostic or Final Summative) */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Question Filter Bar & Bulk Actions */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(30, 41, 59, 0.4)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginRight: 4 }}>
                Filter Questions:
              </span>
              <button
                type="button"
                className={`filter-btn ${questionFilter === 'all' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('all')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: questionFilter === 'all' ? '1px solid var(--brand-primary)' : '1px solid transparent',
                  background: questionFilter === 'all' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                  color: questionFilter === 'all' ? 'var(--brand-primary)' : 'var(--text-muted)',
                }}
              >
                All ({activeQuestions.length})
              </button>

              <button
                type="button"
                className={`filter-btn ${questionFilter === 'draft' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('draft')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: questionFilter === 'draft' ? '1px solid var(--warning)' : '1px solid transparent',
                  background: questionFilter === 'draft' ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                  color: questionFilter === 'draft' ? '#fbbf24' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>Drafts / Review Required</span>
                {draftCount > 0 && (
                  <span
                    style={{
                      background: 'rgba(245, 158, 11, 0.3)',
                      color: '#fbbf24',
                      padding: '1px 7px',
                      borderRadius: 10,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {draftCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                className={`filter-btn ${questionFilter === 'approved' ? 'active' : ''}`}
                onClick={() => setQuestionFilter('approved')}
                style={{
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  border: questionFilter === 'approved' ? '1px solid var(--success)' : '1px solid transparent',
                  background: questionFilter === 'approved' ? 'rgba(16, 185, 129, 0.15)' : 'transparent',
                  color: questionFilter === 'approved' ? '#34d399' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>Approved</span>
                {approvedCount > 0 && (
                  <span
                    style={{
                      background: 'rgba(16, 185, 129, 0.25)',
                      color: '#34d399',
                      padding: '1px 7px',
                      borderRadius: 10,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {approvedCount}
                  </span>
                )}
              </button>

              {rejectedCount > 0 && (
                <button
                  type="button"
                  className={`filter-btn ${questionFilter === 'rejected' ? 'active' : ''}`}
                  onClick={() => setQuestionFilter('rejected')}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.85rem',
                    fontWeight: 500,
                    cursor: 'pointer',
                    border: questionFilter === 'rejected' ? '1px solid var(--danger)' : '1px solid transparent',
                    background: questionFilter === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
                    color: questionFilter === 'rejected' ? '#f87171' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>Rejected</span>
                  <span
                    style={{
                      background: 'rgba(239, 68, 68, 0.25)',
                      color: '#f87171',
                      padding: '1px 7px',
                      borderRadius: 10,
                      fontSize: '0.75rem',
                      fontWeight: 700,
                    }}
                  >
                    {rejectedCount}
                  </span>
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {draftCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  style={{ borderColor: 'rgba(16, 185, 129, 0.5)', color: '#34d399' }}
                  icon={<CheckCircle2 size={15} />}
                  onClick={() => setShowBulkApproveConfirm(true)}
                >
                  Approve All Drafts ({draftCount})
                </Button>
              )}
            </div>
          </div>

          {/* Question Cards List */}
          {filteredQuestions.length === 0 ? (
            <Card>
              <EmptyState
                title={
                  questionFilter === 'draft'
                    ? 'No Pending Drafts'
                    : questionFilter === 'approved'
                    ? 'No Approved Questions'
                    : questionFilter === 'rejected'
                    ? 'No Rejected Questions'
                    : 'No Assessment Questions Configured'
                }
                description={
                  questionFilter === 'draft'
                    ? 'All generated and manual questions have been reviewed. Click below to generate new questions via RAG.'
                    : questionFilter === 'rejected'
                    ? 'No questions have been rejected.'
                    : 'Click "Generate with AI (RAG)" to synthesize questions from an approved document, or add manual questions.'
                }
                icon={<HelpCircle size={32} />}
                actionLabel={questionFilter === 'draft' || questionFilter === 'all' ? 'Generate with AI (RAG)' : undefined}
                onAction={questionFilter === 'draft' || questionFilter === 'all' ? openRagModal : undefined}
              />
            </Card>
          ) : (
            filteredQuestions.map((q, idx) => {
              const isAiGenerated = q.sourceType === 'ai_generated';
              const isDraft = q.status === 'draft';
              const isRejected = q.status === 'rejected';
              const isApproved = q.status === 'approved' || !q.status;
              const isExpanded = expandedPassageIds[q.questionId];
              const isBusy = updatingStatusId === q.questionId;

              return (
                <Card key={q.questionId || idx} padding={false}>
                  {/* Card Header Row */}
                  <div
                    style={{
                      padding: '14px 20px',
                      borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 10,
                      background: isDraft
                        ? 'rgba(245, 158, 11, 0.06)'
                        : isRejected
                        ? 'rgba(239, 68, 68, 0.06)'
                        : 'rgba(15, 23, 42, 0.25)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        Question #{idx + 1}
                      </span>
                      <Badge variant="neutral">{q.topicTag}</Badge>
                      <Badge variant={isAiGenerated ? 'brand' : 'neutral'}>
                        {isAiGenerated ? '🤖 AI Grounded (RAG)' : '👤 Faculty Created'}
                      </Badge>
                      <Badge
                        variant={
                          q.difficulty === 'advanced'
                            ? 'brand'
                            : q.difficulty === 'beginner'
                            ? 'neutral'
                            : 'warning'
                        }
                      >
                        {q.difficulty?.toUpperCase() || 'INTERMEDIATE'} · {q.weight || 10} MARKS
                      </Badge>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Badge
                        variant={isApproved ? 'success' : isDraft ? 'warning' : 'danger'}
                        dot
                      >
                        {isApproved
                          ? 'Approved'
                          : isDraft
                          ? 'Draft / Review Required'
                          : 'Rejected'}
                      </Badge>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div style={{ padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <p style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--text-primary)', lineHeight: 1.5 }}>
                      {q.prompt}
                    </p>

                    {/* Options list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {q.options.map((opt, oIdx) => {
                        const isCorrect = opt.optionId === q.correctOptionId;
                        return (
                          <div
                            key={opt.optionId || oIdx}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 'var(--radius-sm)',
                              background: isCorrect ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.4)',
                              border: isCorrect ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 10,
                              fontSize: '0.875rem',
                              color: isCorrect ? '#34d399' : 'var(--text-secondary)',
                            }}
                          >
                            {isCorrect ? (
                              <CheckCircle size={16} style={{ color: 'var(--success)' }} />
                            ) : (
                              <span style={{ width: 16, textAlign: 'center', opacity: 0.6 }}>
                                {String.fromCharCode(65 + oIdx)}
                              </span>
                            )}
                            <span style={{ fontWeight: isCorrect ? 600 : 400 }}>{opt.text}</span>
                            {isCorrect && (
                              <span
                                style={{
                                  marginLeft: 'auto',
                                  fontSize: '0.75rem',
                                  fontWeight: 600,
                                  color: 'var(--success)',
                                  background: 'rgba(16, 185, 129, 0.15)',
                                  padding: '2px 8px',
                                  borderRadius: 4,
                                }}
                              >
                                Correct Answer
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Pedagogical Rationale */}
                    {q.explanation && (
                      <div
                        style={{
                          fontSize: '0.85rem',
                          color: 'var(--text-secondary)',
                          background: 'rgba(30, 41, 59, 0.4)',
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-sm)',
                          borderLeft: '3px solid var(--brand-primary)',
                        }}
                      >
                        <strong style={{ color: 'var(--text-primary)' }}>Pedagogical Rationale:</strong> {q.explanation}
                      </div>
                    )}

                    {/* Grounded Source Passage Accordion (Requirement 4) */}
                    {q.sourcePassage && (
                      <div
                        style={{
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid rgba(59, 130, 246, 0.3)',
                          background: 'rgba(59, 130, 246, 0.05)',
                          overflow: 'hidden',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => togglePassage(q.questionId)}
                          style={{
                            width: '100%',
                            padding: '10px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: 'none',
                            border: 'none',
                            color: 'var(--brand-primary)',
                            fontSize: '0.85rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <FileText size={16} />
                            <span>Grounded Source Reference: {q.sourceDocumentTitle || 'Learning Document'}</span>
                          </div>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>

                        {isExpanded && (
                          <div
                            style={{
                              padding: '12px 14px',
                              borderTop: '1px solid rgba(59, 130, 246, 0.2)',
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)',
                              lineHeight: 1.6,
                              background: 'rgba(15, 23, 42, 0.6)',
                              fontStyle: 'italic',
                            }}
                          >
                            "{q.sourcePassage}"
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* DEDICATED VISIBLE ACTION TOOLBAR (NEVER CLIPPED) */}
                  <div
                    style={{
                      padding: '12px 20px',
                      borderTop: '1px solid var(--border-subtle)',
                      background: 'rgba(15, 23, 42, 0.4)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: 12,
                    }}
                  >
                    {/* Primary Review Controls (Approve / Reject) */}
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      {isDraft && (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            style={{
                              background: '#059669',
                              borderColor: '#059669',
                              color: '#ffffff',
                              fontWeight: 600,
                              boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                            }}
                            icon={isBusy ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
                            onClick={() => handleUpdateStatus(q.questionId, 'approved')}
                            disabled={isBusy}
                          >
                            Approve Question
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            style={{
                              color: '#ef4444',
                              borderColor: 'rgba(239, 68, 68, 0.45)',
                              fontWeight: 600,
                            }}
                            icon={isBusy ? <Loader2 className="animate-spin" size={15} /> : <XCircle size={15} />}
                            onClick={() => handleUpdateStatus(q.questionId, 'rejected')}
                            disabled={isBusy}
                          >
                            Reject Question
                          </Button>
                        </>
                      )}

                      {isApproved && (
                        <>
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: '0.85rem',
                              color: '#34d399',
                              fontWeight: 600,
                              marginRight: 6,
                            }}
                          >
                            <CheckCircle2 size={16} /> Approved for Assessment
                          </span>

                          <Button
                            variant="outline"
                            size="sm"
                            style={{ color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.35)' }}
                            icon={<XCircle size={14} />}
                            onClick={() => handleUpdateStatus(q.questionId, 'rejected')}
                            disabled={isBusy}
                          >
                            Reject
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            style={{ color: 'var(--text-muted)' }}
                            icon={<RotateCcw size={14} />}
                            onClick={() => handleUpdateStatus(q.questionId, 'draft')}
                            disabled={isBusy}
                          >
                            Move to Draft
                          </Button>
                        </>
                      )}

                      {isRejected && (
                        <>
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              fontSize: '0.85rem',
                              color: '#f87171',
                              fontWeight: 600,
                              marginRight: 6,
                            }}
                          >
                            <XCircle size={16} /> Rejected Question
                          </span>

                          <Button
                            variant="primary"
                            size="sm"
                            style={{ background: '#059669', borderColor: '#059669', color: '#fff', fontWeight: 600 }}
                            icon={<CheckCircle2 size={15} />}
                            onClick={() => handleUpdateStatus(q.questionId, 'approved')}
                            disabled={isBusy}
                          >
                            Approve Question
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            style={{ color: 'var(--warning)', borderColor: 'rgba(245, 158, 11, 0.35)' }}
                            icon={<RotateCcw size={14} />}
                            onClick={() => handleUpdateStatus(q.questionId, 'draft')}
                            disabled={isBusy}
                          >
                            Restore to Draft
                          </Button>
                        </>
                      )}
                    </div>

                    {/* Edit & Delete Controls */}
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Button
                        variant="outline"
                        size="sm"
                        icon={<Edit2 size={14} />}
                        onClick={() => openEditQuestionModal(q)}
                      >
                        Edit Question
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        style={{ color: 'var(--danger)' }}
                        icon={<Trash2 size={14} />}
                        onClick={() => setDeletingQuestion(q)}
                      >
                        Delete / Archive
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* RAG Assessment Question Generation Modal */}
      {showRagModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={20} style={{ color: 'var(--brand-primary)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  Generate Assessment Questions with AI (RAG)
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRagModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleGenerateRagQuestions}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <Alert type="info">
                  The AI retrieves indexed chunks from your approved learning resource and extracts strictly grounded questions. All generated questions will initially be placed in <strong>Draft status</strong> for your review.
                </Alert>

                <FormField label="Source Learning Document (Vector-Indexed)" required>
                  {loadingResources ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 8 }}>
                      <Loader2 className="animate-spin" size={16} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Fetching verified indexed documents...
                      </span>
                    </div>
                  ) : learningResources.length === 0 ? (
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 'var(--radius-sm)',
                        background: 'rgba(245, 158, 11, 0.1)',
                        border: '1px solid rgba(245, 158, 11, 0.3)',
                        fontSize: '0.85rem',
                        color: '#fbbf24',
                      }}
                    >
                      No vector-indexed documents found. Please visit <strong>Approved Resources</strong> and upload a document to enable AI question generation.
                    </div>
                  ) : (
                    <select
                      className="form-input"
                      value={selectedResourceId}
                      onChange={(e) => setSelectedResourceId(e.target.value)}
                      required
                    >
                      {learningResources.map((res) => (
                        <option key={res._id} value={res._id}>
                          {res.title} ({res.category}) — {res.ragMetadata?.chunkCount || 0} Chunks Indexed
                        </option>
                      ))}
                    </select>
                  )}
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField label="Number of Questions" required>
                    <select
                      className="form-input"
                      value={ragCount}
                      onChange={(e) => setRagCount(Number(e.target.value))}
                    >
                      <option value={3}>3 Questions</option>
                      <option value={5}>5 Questions (Recommended)</option>
                      <option value={8}>8 Questions</option>
                      <option value={10}>10 Questions</option>
                    </select>
                  </FormField>

                  <FormField label="Target Difficulty">
                    <select
                      className="form-input"
                      value={ragDifficulty}
                      onChange={(e) => setRagDifficulty(e.target.value as any)}
                    >
                      <option value="all">All Difficulties (Balanced)</option>
                      <option value="beginner">Beginner Only</option>
                      <option value="intermediate">Intermediate Only</option>
                      <option value="advanced">Advanced Only</option>
                    </select>
                  </FormField>
                </div>

                <FormField label="Optional Topic Focus (Keywords)">
                  <input
                    type="text"
                    className="form-input"
                    value={ragTopicFocus}
                    onChange={(e) => setRagTopicFocus(e.target.value)}
                    placeholder="e.g. Transient Response, Time Constant, Cutoff Frequency"
                  />
                </FormField>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="ghost" type="button" onClick={() => setShowRagModal(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  type="submit"
                  disabled={isGeneratingRag || learningResources.length === 0}
                  icon={isGeneratingRag ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />}
                >
                  {isGeneratingRag ? 'Synthesizing Questions from Chunks...' : 'Generate Grounded Drafts'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Approve Confirmation Modal (Requirement 9) */}
      {showBulkApproveConfirm && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 460 }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                  Confirm Bulk Question Approval
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowBulkApproveConfirm(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Are you sure you want to approve all <strong>{draftCount}</strong> pending draft question(s)?
              </p>
              <div
                style={{
                  marginTop: 12,
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  fontSize: '0.85rem',
                  color: '#34d399',
                }}
              >
                All approved questions will become part of this assessment and will be presented to enrolled students once the assessment is published.
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={() => setShowBulkApproveConfirm(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                style={{ background: '#059669', borderColor: '#059669' }}
                onClick={handleConfirmBulkApprove}
                disabled={isBulkApproving}
                icon={isBulkApproving ? <Loader2 className="animate-spin" size={15} /> : <CheckCircle2 size={15} />}
              >
                {isBulkApproving ? 'Approving...' : `Confirm & Approve All (${draftCount})`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Settings & Publish Modal */}
      {showSettingsModal && assessment && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Assessment Settings & Publishing</h3>
              <button
                type="button"
                onClick={() => setShowSettingsModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <FormField label="Passing Score (%)" required>
                  <input
                    type="number"
                    min={30}
                    max={100}
                    className="form-input"
                    value={passPercent}
                    onChange={(e) => setPassPercent(Number(e.target.value))}
                  />
                </FormField>

                <FormField label="Time Limit (Minutes)" required>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    className="form-input"
                    value={timeLimit}
                    onChange={(e) => setTimeLimit(Number(e.target.value))}
                  />
                </FormField>
              </div>

              <div
                style={{
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(15, 23, 42, 0.4)',
                  border: '1px solid var(--border-subtle)',
                  fontSize: '0.85rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Approved Questions:</span>
                  <strong>{approvedCount} items</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Pending Drafts:</span>
                  <strong>{draftCount} items</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Current Status:</span>
                  <Badge variant={assessment.status === 'published' ? 'success' : 'warning'}>
                    {assessment.status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {approvedCount === 0 && (
                <Alert type="warning">
                  At least 1 approved question is required before this assessment can be published to students.
                </Alert>
              )}
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={() => setShowSettingsModal(false)}>
                Cancel
              </Button>
              {assessment.status === 'published' ? (
                <Button
                  variant="outline"
                  onClick={() => handleTogglePublish('draft')}
                  disabled={isPublishing}
                >
                  {isPublishing ? 'Updating...' : 'Unpublish Assessment'}
                </Button>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => handleTogglePublish('published')}
                  disabled={isPublishing || approvedCount === 0}
                  icon={isPublishing ? <Loader2 className="animate-spin" size={16} /> : <Send size={16} />}
                >
                  {isPublishing ? 'Publishing...' : 'Publish to Students'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Question Modal */}
      {showQuestionModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                {isEditing ? 'Edit Assessment Question' : 'Add New Assessment Question'}
              </h3>
              <button
                type="button"
                onClick={() => setShowQuestionModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleSaveQuestion}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <FormField label="Question Prompt / Text" required>
                  <textarea
                    className="form-input"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Enter the full question prompt clearly..."
                    rows={3}
                    required
                  />
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  <FormField label="Topic Tag" required>
                    <input
                      type="text"
                      className="form-input"
                      value={topicTag}
                      onChange={(e) => setTopicTag(e.target.value)}
                      placeholder="e.g. RC Circuit Transient"
                      required
                    />
                  </FormField>

                  <FormField label="Difficulty">
                    <select
                      className="form-input"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as 'beginner' | 'intermediate' | 'advanced')}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </FormField>

                  <FormField label="Marks / Weight">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      className="form-input"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </FormField>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Answer Options (Select correct radio button) <span style={{ color: 'var(--danger)' }}>*</span>
                  </label>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOpt === 'opt_a'}
                      onChange={() => setCorrectOpt('opt_a')}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Option A (Required)"
                      value={optA}
                      onChange={(e) => setOptA(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOpt === 'opt_b'}
                      onChange={() => setCorrectOpt('opt_b')}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Option B (Required)"
                      value={optB}
                      onChange={(e) => setOptB(e.target.value)}
                      required
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOpt === 'opt_c'}
                      onChange={() => setCorrectOpt('opt_c')}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Option C (Optional)"
                      value={optC}
                      onChange={(e) => setOptC(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="radio"
                      name="correctOption"
                      checked={correctOpt === 'opt_d'}
                      onChange={() => setCorrectOpt('opt_d')}
                    />
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Option D (Optional)"
                      value={optD}
                      onChange={(e) => setOptD(e.target.value)}
                    />
                  </div>
                </div>

                <FormField label="Pedagogical Rationale / Explanation (Feedback to student)">
                  <textarea
                    className="form-input"
                    value={explanation}
                    onChange={(e) => setExplanation(e.target.value)}
                    placeholder="Explain the theoretical or experimental reasoning why the selected option is correct..."
                    rows={2}
                  />
                </FormField>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="ghost" type="button" onClick={() => setShowQuestionModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : isEditing ? 'Update Question' : 'Save Question'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Question Confirmation Dialog */}
      {deletingQuestion && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--danger)' }}>
                Delete Assessment Question
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Are you sure you want to delete this question? If students have already answered this question in previous assessment attempts, it will be safely archived to preserve historical grading records.
              </p>
              <div
                style={{
                  fontSize: '0.85rem',
                  color: 'var(--text-primary)',
                  padding: 10,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(15, 23, 42, 0.4)',
                  marginTop: 10,
                }}
              >
                "{deletingQuestion.prompt}"
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={() => setDeletingQuestion(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteQuestion}
                disabled={isDeleting}
                icon={isDeleting ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
