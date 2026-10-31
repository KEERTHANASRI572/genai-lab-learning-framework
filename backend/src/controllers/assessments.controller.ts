import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Assessment, IAssessment, IAssessmentQuestion, AssessmentType, QuestionApprovalStatus } from '../models/Assessment';
import { AssessmentAttempt, IAssessmentAttempt, ITopicEvidence } from '../models/AssessmentAttempt';
import { LearnerProfile, LearningLevel } from '../models/LearnerProfile';
import { Experiment } from '../models/Experiment';
import { LearningSession } from '../models/LearningSession';
import { generateAssessmentQuestionsFromResource } from '../services/ragQuestionGenerator.service';
import {
  ensureDatabaseReady,
  isValidObjectId,
  recordAuditLog,
  sendError,
  sendSuccess,
} from '../utils/apiResponse';

/**
 * Diagnosis Recommendation Criteria:
 * Evaluates concept-wise topic proficiency and prerequisite mastery.
 */
export const calculateDiagnosis = (
  topicEvidence: ITopicEvidence[],
  overallPercent: number,
  prerequisites: string[]
): {
  level: LearningLevel;
  explanation: string;
  recommendedPath: string;
  prerequisiteGaps: string[];
  facultySupportRecommended: boolean;
} => {
  const prerequisiteGaps: string[] = [];
  const normalizedPrereqs = prerequisites.map((p) => p.toLowerCase());

  // Detect prerequisite gaps
  for (const topic of topicEvidence) {
    const isPrereq = normalizedPrereqs.some(
      (pr) => pr.includes(topic.topicTag.toLowerCase()) || topic.topicTag.toLowerCase().includes(pr)
    );
    if ((isPrereq && topic.calculatedScore < 60) || topic.calculatedScore < 50) {
      prerequisiteGaps.push(topic.topicTag);
    }
  }

  // Determine Level based on multifaceted evidence:
  let level: LearningLevel;
  let explanation: string;
  let recommendedPath: string;
  let facultySupportRecommended = false;

  if (overallPercent < 50 || prerequisiteGaps.length >= 2) {
    level = 'beginner';
    explanation = `Diagnostic performance (${overallPercent.toFixed(1)}%) indicates foundational concept gaps in: [${
      prerequisiteGaps.join(', ') || 'core principles'
    }]. Step-by-step guidance, prerequisite concept reinforcement, and scaffolded practice are recommended.`;
    recommendedPath = 'Basic / Beginner Path: Prerequisite revision, structured walkthroughs, and frequent comprehension checkpoints.';
    if (overallPercent < 40) {
      facultySupportRecommended = true;
    }
  } else if (overallPercent >= 80 && prerequisiteGaps.length === 0) {
    level = 'advanced';
    explanation = `Student demonstrated strong conceptual mastery (${overallPercent.toFixed(1)}%) across all topic areas with zero prerequisite gaps. Scaffolding is reduced to encourage independent problem-solving and extension analysis.`;
    recommendedPath = 'Advanced Path: Deep technical explanations, complex experimental scenarios, and open-ended verification.';
  } else {
    level = 'intermediate';
    explanation = `Student achieved satisfactory grasp (${overallPercent.toFixed(1)}%) of foundational concepts with minor gaps in [${
      prerequisiteGaps.join(', ') || 'specific application areas'
    }]. Guided experiment execution with focused hints is recommended.`;
    recommendedPath = 'Intermediate Path: Application-focused guidance, standard experimental workflow, and moderate practice.';
  }

  return {
    level,
    explanation,
    recommendedPath,
    prerequisiteGaps,
    facultySupportRecommended,
  };
};

/**
 * Get assessment questions for a specific experiment and type.
 * For students: strips correct options and explanations to prevent cheating.
 */
export const getAssessmentForExperiment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { experimentId } = req.params;
  const type = (req.query['type'] as string) || 'initial_diagnostic';

  if (!isValidObjectId(experimentId)) {
    sendError(res, 'INVALID_ID', 'Invalid experiment ID format.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    // Verify experiment belongs to tenant
    const experiment = await Experiment.findOne({ _id: experimentId, institutionId: tenantId }).lean();
    if (!experiment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Experiment not found in your institution.', 404, undefined, req);
      return;
    }

    if (req.user?.role === 'student' && experiment.status !== 'published') {
      sendError(res, 'ACCESS_DENIED', 'This laboratory experiment has not been published yet.', 403, undefined, req);
      return;
    }

    const assessmentType: AssessmentType = (type as AssessmentType) || 'initial_diagnostic';

    // Look for assessment config
    const assessment = (await Assessment.findOne({
      experimentId,
      institutionId: tenantId,
      type: assessmentType,
    }).lean()) as (IAssessment & { _id: unknown }) | null;

    if (!assessment) {
      sendError(
        res,
        'ASSESSMENT_NOT_CONFIGURED',
        `No ${type.replace('_', ' ')} assessment is published for this experiment. Please contact your instructor.`,
        404,
        undefined,
        req
      );
      return;
    }

    // Sanitize question data for student callers: only serve approved, non-archived questions
    if (req.user?.role === 'student') {
      if (assessment.status !== 'published') {
        sendError(
          res,
          'ASSESSMENT_NOT_PUBLISHED',
          'This assessment is currently in draft and has not been published by your instructor.',
          403,
          undefined,
          req
        );
        return;
      }

      const activeApprovedQuestions = (assessment.questions || []).filter(
        (q: IAssessmentQuestion) => (q.status === 'approved' || !q.status) && !q.isArchived
      );

      if (activeApprovedQuestions.length === 0) {
        sendError(
          res,
          'ASSESSMENT_NOT_CONFIGURED',
          'No approved questions are currently available for this assessment.',
          404,
          undefined,
          req
        );
        return;
      }

      const sanitizedQuestions = activeApprovedQuestions.map((q: IAssessmentQuestion) => ({
        questionId: q.questionId,
        topicTag: q.topicTag,
        prompt: q.prompt,
        options: q.options,
        difficulty: q.difficulty,
        weight: q.weight,
      }));

      sendSuccess(res, {
        ...assessment,
        questions: sanitizedQuestions,
      });
      return;
    }

    sendSuccess(res, assessment);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query assessment.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Submit assessment attempt:
 * Grades answers, evaluates concept-wise performance, computes diagnosis, and persists attempt.
 */
export const submitAssessmentAttempt = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const studentId = req.user?.id;
  const assessmentId = req.params.assessmentId || req.body.assessmentId;
  const { answers, durationSeconds } = req.body;

  if (!isValidObjectId(assessmentId)) {
    sendError(res, 'INVALID_ID', 'Invalid assessment ID.', 400, undefined, req);
    return;
  }

  if (!Array.isArray(answers)) {
    sendError(res, 'VALIDATION_FAILED', 'Answers must be provided as an array.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const assessment = await Assessment.findOne({ _id: assessmentId, institutionId: tenantId });
    if (!assessment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment not found in your institution.', 404, undefined, req);
      return;
    }

    const experiment = await Experiment.findOne({ _id: assessment.experimentId, institutionId: tenantId }).lean();
    const prerequisites = experiment?.prerequisites || [];
    const resolvedSubjectId = req.body.subjectId || experiment?.subjectId;
    const resolvedCourseId = req.body.courseId || experiment?.courseId;

    // Map questions for O(1) answer validation
    const questionMap = new Map<string, IAssessmentQuestion>();
    for (const q of assessment.questions) {
      questionMap.set(q.questionId, q);
    }

    let totalWeight = 0;
    let earnedScore = 0;
    const evaluatedAnswers: {
      questionId: string;
      topicTag: string;
      selectedOptionId: string;
      isCorrect: boolean;
      timeSpentSeconds: number;
    }[] = [];

    // Concept-wise tracking
    const topicStats = new Map<string, { total: number; correct: number; totalWeight: number; earnedWeight: number }>();

    for (const ans of answers) {
      const q = questionMap.get(ans.questionId);
      if (!q) continue;

      const isCorrect = String(ans.selectedOptionId).trim() === String(q.correctOptionId).trim();
      const weight = q.weight || 1;
      totalWeight += weight;

      if (isCorrect) {
        earnedScore += weight;
      }

      evaluatedAnswers.push({
        questionId: q.questionId,
        topicTag: q.topicTag,
        selectedOptionId: ans.selectedOptionId,
        isCorrect,
        timeSpentSeconds: Number(ans.timeSpentSeconds) || 0,
      });

      const currentStats = topicStats.get(q.topicTag) || { total: 0, correct: 0, totalWeight: 0, earnedWeight: 0 };
      currentStats.total += 1;
      currentStats.totalWeight += weight;
      if (isCorrect) {
        currentStats.correct += 1;
        currentStats.earnedWeight += weight;
      }
      topicStats.set(q.topicTag, currentStats);
    }

    const scorePercent = totalWeight > 0 ? Math.round((earnedScore / totalWeight) * 100) : 0;
    const passed = scorePercent >= (assessment.passingScorePercent || 60);

    // Build concept-wise topic proficiency evidence
    const topicEvidence: ITopicEvidence[] = [];
    for (const [topicTag, stats] of topicStats.entries()) {
      const calculatedScore = stats.totalWeight > 0 ? Math.round((stats.earnedWeight / stats.totalWeight) * 100) : 0;
      topicEvidence.push({
        topicTag,
        questionsTotal: stats.total,
        questionsCorrect: stats.correct,
        calculatedScore,
      });
    }

    // Determine diagnosis & explainable recommendation
    const diagnosis = calculateDiagnosis(topicEvidence, scorePercent, prerequisites);

    // Calculate next attempt number
    const previousAttemptsCount = await AssessmentAttempt.countDocuments({
      institutionId: tenantId,
      studentId,
      experimentId: assessment.experimentId,
    });

    // Persist assessment attempt
    const attempt: IAssessmentAttempt = await AssessmentAttempt.create({
      institutionId: tenantId,
      assessmentId: assessment._id,
      experimentId: assessment.experimentId,
      subjectId: resolvedSubjectId || undefined,
      courseId: resolvedCourseId || undefined,
      studentId,
      attemptNumber: previousAttemptsCount + 1,
      type: assessment.type,
      startedAt: new Date(Date.now() - (Number(durationSeconds) || 60) * 1000),
      submittedAt: new Date(),
      durationSeconds: Number(durationSeconds) || 60,
      answers: evaluatedAnswers,
      totalScore: earnedScore,
      maxScore: totalWeight,
      scorePercent,
      passed,
      determinedLearningLevel: diagnosis.level,
      topicProficiencyEvidence: topicEvidence,
      prerequisiteGaps: diagnosis.prerequisiteGaps,
      diagnosisExplanation: diagnosis.explanation,
      recommendedPath: diagnosis.recommendedPath,
      facultySupportRecommended: diagnosis.facultySupportRecommended,
      status: 'completed',
    });

    // Update Learner Profile topic proficiencies
    if (studentId) {
      let profile = await LearnerProfile.findOne({ studentId, institutionId: tenantId });
      if (!profile) {
        profile = new LearnerProfile({
          studentId,
          institutionId: tenantId,
          topicProficiencies: [],
          telemetrySummary: {
            totalExperimentsCompleted: 0,
            totalLabHours: 0,
            totalHelpRequests: 0,
          },
          status: 'active',
        });
      }

      // Merge new evidence into learner profile
      for (const ev of topicEvidence) {
        const existingIdx = profile.topicProficiencies.findIndex((p) => p.topicTag === ev.topicTag);
        const level: LearningLevel = ev.calculatedScore >= 80 ? 'advanced' : ev.calculatedScore >= 50 ? 'intermediate' : 'beginner';
        const confidenceScore = Math.min(1.0, Math.max(0.0, ev.calculatedScore / 100));

        const proficiencyRecord = {
          topicTag: ev.topicTag,
          experimentId: assessment.experimentId,
          currentLevel: level,
          confidenceScore,
          evidenceSource: assessment.type === 'initial_diagnostic' ? ('initial_diagnostic' as const) : ('final_summative' as const),
          assessmentAttemptId: attempt._id,
          assessedAt: new Date(),
          notes: `Assessed via ${assessment.type}. Scored ${ev.calculatedScore}%.`,
        };

        if (existingIdx !== -1) {
          profile.topicProficiencies[existingIdx] = proficiencyRecord;
        } else {
          profile.topicProficiencies.push(proficiencyRecord);
        }
      }

      profile.telemetrySummary.lastActiveAt = new Date();
      await profile.save();

      // Update or create active LearningSession with diagnosed learning level
      let session = await LearningSession.findOne({
        studentId,
        experimentId: assessment.experimentId,
        institutionId: tenantId,
        sessionStatus: { $in: ['in_progress', 'paused'] },
      });

      if (session) {
        session.assignedScaffoldingLevel = diagnosis.level;
        await session.save();
      } else {
        await LearningSession.create({
          institutionId: tenantId,
          studentId,
          experimentId: assessment.experimentId,
          laboratoryId: experiment?.laboratoryId,
          sessionStatus: 'in_progress',
          startedAt: new Date(),
          assignedScaffoldingLevel: diagnosis.level,
          currentStepNumber: 1,
          stepProgress: (experiment?.procedureSteps || []).map((step: any) => ({
            stepNumber: step.stepNumber,
            title: step.title,
            status: step.stepNumber === 1 ? 'in_progress' : 'pending',
          })),
          aiInteractions: [],
          telemetry: {
            totalDurationSeconds: 0,
            aiQueriesCount: 0,
            escalationsCount: 0,
            errorsEncounteredCount: 0,
          },
        });
      }
    }

    await recordAuditLog({
      req,
      action: 'ASSESSMENT_SUBMITTED',
      targetDomain: 'assessment',
      targetResourceId: attempt._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: {
        experimentId: assessment.experimentId,
        scorePercent,
        determinedLevel: diagnosis.level,
        prerequisiteGapsCount: diagnosis.prerequisiteGaps.length,
      },
    });

    sendSuccess(
      res,
      {
        _id: attempt._id.toString(),
        attemptId: attempt._id.toString(),
        scorePercent,
        totalScore: earnedScore,
        maxScore: totalWeight,
        passed,
        determinedLearningLevel: diagnosis.level,
        topicProficiencyEvidence: topicEvidence,
        prerequisiteGaps: diagnosis.prerequisiteGaps,
        diagnosisExplanation: diagnosis.explanation,
        recommendedPath: diagnosis.recommendedPath,
        facultySupportRecommended: diagnosis.facultySupportRecommended,
        submittedAt: attempt.submittedAt,
      },
      { message: 'Assessment evaluated and persisted successfully.' },
      201
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to evaluate assessment submission.';
    sendError(res, 'SUBMISSION_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Get specific assessment attempt by ID.
 * Enforces institution isolation and ownership: student can only read own attempt.
 */
export const getAssessmentAttemptById = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { attemptId } = req.params;

  if (!isValidObjectId(attemptId)) {
    sendError(res, 'INVALID_ID', 'Invalid attempt ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const query: Record<string, unknown> = { _id: attemptId, institutionId: tenantId };
    if (req.user?.role === 'student') {
      query['studentId'] = req.user.id;
    }

    const attempt = await AssessmentAttempt.findOne(query)
      .populate('experimentId', 'title code prerequisites objectives')
      .lean();

    if (!attempt) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment attempt not found or access denied.', 404, undefined, req);
      return;
    }

    sendSuccess(res, attempt);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve assessment attempt.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Author / Create a new Assessment for an experiment (Faculty, College Admin).
 */
export const createAssessment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const facultyUserId = req.user?.id;
  const { experimentId, type, title, description, passingScorePercent, timeLimitMins, questions = [], status } = req.body;

  if (!experimentId || !type || !title) {
    sendError(res, 'VALIDATION_FAILED', 'experimentId, type, and title are required.', 400, undefined, req);
    return;
  }

  if (questions !== undefined && !Array.isArray(questions)) {
    sendError(res, 'VALIDATION_FAILED', 'questions must be an array.', 400, undefined, req);
    return;
  }

  if (!isValidObjectId(experimentId)) {
    sendError(res, 'INVALID_ID', 'experimentId is invalid.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const experiment = await Experiment.findOne({ _id: experimentId, institutionId: tenantId });
    if (!experiment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Experiment not found in your institution.', 404, undefined, req);
      return;
    }

    // Idempotency: If an assessment already exists for this experiment and type, return it gracefully
    const existing = await Assessment.findOne({
      experimentId,
      institutionId: tenantId,
      type: type as AssessmentType,
    });

    if (existing) {
      if (Array.isArray(questions) && questions.length > 0) {
        existing.questions.push(...questions);
        existing.version = (existing.version || 1) + 1;
        await existing.save();
      }
      sendSuccess(res, existing, { message: 'Assessment already configured for this experiment.' }, 200);
      return;
    }

    const assessment: IAssessment = await Assessment.create({
      institutionId: tenantId,
      experimentId,
      type,
      title,
      description,
      passingScorePercent: passingScorePercent || 60,
      timeLimitMins: timeLimitMins || 20,
      questions: Array.isArray(questions) ? questions : [],
      status: status || 'draft',
      authorFacultyUserId: facultyUserId,
    });

    await recordAuditLog({
      req,
      action: 'ASSESSMENT_CREATED',
      targetDomain: 'curriculum',
      targetResourceId: assessment._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: { experimentId, title, type, questionsCount: assessment.questions.length },
    });

    sendSuccess(res, assessment, { message: 'Assessment created successfully.' }, 201);
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      const existing = await Assessment.findOne({
        experimentId,
        institutionId: tenantId,
        type: type as AssessmentType,
      });
      if (existing) {
        sendSuccess(res, existing, { message: 'Assessment already exists for this experiment.' }, 200);
        return;
      }
    }
    sendError(res, 'VALIDATION_FAILED', mongoErr.message || 'Failed to create assessment.', 400, undefined, req);
  }
};

/**
 * Update assessment configuration and questions (Faculty, College Admin, Platform Admin).
 */
export const updateAssessment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid assessment ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  const { title, description, passingScorePercent, timeLimitMins, questions, status } = req.body;
  const updatePayload: Record<string, unknown> = {};

  if (title !== undefined) updatePayload['title'] = title;
  if (description !== undefined) updatePayload['description'] = description;
  if (passingScorePercent !== undefined) updatePayload['passingScorePercent'] = passingScorePercent;
  if (timeLimitMins !== undefined) updatePayload['timeLimitMins'] = timeLimitMins;
  if (questions !== undefined) updatePayload['questions'] = questions;
  if (status !== undefined) updatePayload['status'] = status;

  try {
    const existing = await Assessment.findOne({ _id: id, institutionId: tenantId });
    if (!existing) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment not found in your institution.', 404, undefined, req);
      return;
    }

    if (status === 'published') {
      const activeQuestions = (questions !== undefined ? questions : existing.questions) || [];
      const hasApproved = activeQuestions.some(
        (q: IAssessmentQuestion) => (q.status === 'approved' || !q.status) && !q.isArchived
      );
      if (!hasApproved) {
        sendError(
          res,
          'PUBLISH_REJECTED',
          'Cannot publish assessment without at least one approved question. Please review and approve draft questions before publishing.',
          400,
          undefined,
          req
        );
        return;
      }
    }

    if (questions !== undefined || title !== undefined || passingScorePercent !== undefined) {
      updatePayload['version'] = (existing.version || 1) + 1;
    }

    const updated = await Assessment.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'ASSESSMENT_UPDATED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: updatePayload,
    });

    sendSuccess(res, updated, { message: 'Assessment updated successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update assessment.';
    sendError(res, 'UPDATE_FAILED', msg, 400, undefined, req);
  }
};

/**
 * Soft-delete / archive assessment (Faculty, College Admin, Platform Admin).
 */
export const deleteAssessment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid assessment ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const updated = await Assessment.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: { status: 'archived' } },
      { new: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'ASSESSMENT_ARCHIVED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { status: 'archived' },
    });

    sendSuccess(res, updated, { message: 'Assessment has been archived.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to archive assessment.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Get assessment by ID (Faculty, College Admin, Platform Admin).
 */
export const getAssessmentById = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid assessment ID format.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const assessment = await Assessment.findOne({ _id: id, institutionId: tenantId })
      .populate('experimentId', 'title code laboratoryId courseId')
      .lean();

    if (!assessment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment not found in your institution.', 404, undefined, req);
      return;
    }

    sendSuccess(res, assessment);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query assessment.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Add a question to an assessment (Faculty, College Admin, Platform Admin).
 */
export const addQuestionToAssessment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid assessment ID format.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  const { prompt, topicTag, options, correctOptionId, explanation, difficulty, weight } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    sendError(res, 'VALIDATION_FAILED', 'Question prompt is required.', 400, undefined, req);
    return;
  }

  if (!topicTag || typeof topicTag !== 'string' || !topicTag.trim()) {
    sendError(res, 'VALIDATION_FAILED', 'Topic tag is required for pedagogical evidence tracking.', 400, undefined, req);
    return;
  }

  if (!Array.isArray(options) || options.length < 2) {
    sendError(res, 'VALIDATION_FAILED', 'At least 2 answer options are required.', 400, undefined, req);
    return;
  }

  for (let i = 0; i < options.length; i++) {
    const opt = options[i];
    if (!opt.optionId || !opt.text || !opt.text.trim()) {
      sendError(res, 'VALIDATION_FAILED', `Option #${i + 1} must contain valid optionId and text.`, 400, undefined, req);
      return;
    }
  }

  if (!correctOptionId || !options.some((o: { optionId: string }) => o.optionId === correctOptionId)) {
    sendError(res, 'VALIDATION_FAILED', 'Correct option identifier must match one of the provided options.', 400, undefined, req);
    return;
  }

  const validDifficulties = ['beginner', 'intermediate', 'advanced'];
  const validatedDifficulty = validDifficulties.includes(difficulty) ? difficulty : 'intermediate';
  const validatedWeight = typeof weight === 'number' && weight > 0 ? weight : 10;
  const questionId = req.body.questionId || `q_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

  const newQuestion: IAssessmentQuestion = {
    questionId,
    prompt: prompt.trim(),
    topicTag: topicTag.trim(),
    options: options.map((o: { optionId: string; text: string }) => ({
      optionId: String(o.optionId).trim(),
      text: String(o.text).trim(),
    })),
    correctOptionId: String(correctOptionId).trim(),
    explanation: explanation ? String(explanation).trim() : undefined,
    difficulty: validatedDifficulty,
    weight: validatedWeight,
    sourceType: 'faculty_created',
    status: 'approved',
    authorFacultyUserId: req.user?.id ? new mongoose.Types.ObjectId(req.user.id) : undefined,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  try {
    const assessment = await Assessment.findOne({ _id: id, institutionId: tenantId });
    if (!assessment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment not found in your institution.', 404, undefined, req);
      return;
    }

    assessment.questions.push(newQuestion);
    await assessment.save();

    await recordAuditLog({
      req,
      action: 'QUESTION_ADDED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { questionId, prompt: newQuestion.prompt, topicTag: newQuestion.topicTag },
    });

    sendSuccess(res, assessment, { message: 'Question added successfully to assessment.' }, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to add question.';
    sendError(res, 'SAVE_FAILED', msg, 400, undefined, req);
  }
};

/**
 * Update an existing question within an assessment (Faculty, College Admin, Platform Admin).
 */
export const updateQuestionInAssessment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id, questionId } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid assessment ID format.', 400, undefined, req);
    return;
  }

  if (!questionId) {
    sendError(res, 'VALIDATION_FAILED', 'Question ID is required.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  const { prompt, topicTag, options, correctOptionId, explanation, difficulty, weight } = req.body;

  try {
    const assessment = await Assessment.findOne({ _id: id, institutionId: tenantId });
    if (!assessment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment not found in your institution.', 404, undefined, req);
      return;
    }

    const qIdx = assessment.questions.findIndex((q) => q.questionId === questionId);
    if (qIdx === -1 || !assessment.questions[qIdx]) {
      sendError(res, 'RESOURCE_NOT_FOUND', `Question "${questionId}" not found in this assessment.`, 404, undefined, req);
      return;
    }

    const currentQ = assessment.questions[qIdx]!;
    if (prompt !== undefined && (!prompt || !prompt.trim())) {
      sendError(res, 'VALIDATION_FAILED', 'Prompt cannot be empty.', 400, undefined, req);
      return;
    }
    if (topicTag !== undefined && (!topicTag || !topicTag.trim())) {
      sendError(res, 'VALIDATION_FAILED', 'Topic tag cannot be empty.', 400, undefined, req);
      return;
    }

    if (options !== undefined) {
      if (!Array.isArray(options) || options.length < 2) {
        sendError(res, 'VALIDATION_FAILED', 'At least 2 options required.', 400, undefined, req);
        return;
      }
      currentQ.options = options.map((o: { optionId: string; text: string }) => ({
        optionId: String(o.optionId).trim(),
        text: String(o.text).trim(),
      }));
    }

    if (prompt !== undefined) currentQ.prompt = prompt.trim();
    if (topicTag !== undefined) currentQ.topicTag = topicTag.trim();
    if (correctOptionId !== undefined) {
      if (!currentQ.options.some((o) => o.optionId === correctOptionId)) {
        sendError(res, 'VALIDATION_FAILED', 'Correct option must match one of the available options.', 400, undefined, req);
        return;
      }
      currentQ.correctOptionId = String(correctOptionId).trim();
    }
    if (explanation !== undefined) currentQ.explanation = String(explanation).trim();
    if (difficulty !== undefined) {
      const valid = ['beginner', 'intermediate', 'advanced'];
      if (valid.includes(difficulty)) currentQ.difficulty = difficulty;
    }
    if (weight !== undefined && typeof weight === 'number' && weight > 0) {
      currentQ.weight = weight;
    }
    if (req.body.status !== undefined) {
      const validStatuses: QuestionApprovalStatus[] = ['draft', 'approved', 'rejected'];
      if (validStatuses.includes(req.body.status)) {
        currentQ.status = req.body.status;
      }
    }
    currentQ.updatedAt = new Date();

    assessment.markModified('questions');
    await assessment.save();

    await recordAuditLog({
      req,
      action: 'QUESTION_UPDATED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { questionId, prompt: currentQ.prompt },
    });

    sendSuccess(res, assessment, { message: 'Question updated successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update question.';
    sendError(res, 'UPDATE_FAILED', msg, 400, undefined, req);
  }
};

/**
 * Delete a question from an assessment (Faculty, College Admin, Platform Admin).
 */
export const deleteQuestionFromAssessment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id, questionId } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid assessment ID format.', 400, undefined, req);
    return;
  }

  if (!questionId) {
    sendError(res, 'VALIDATION_FAILED', 'Question ID is required.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const assessment = await Assessment.findOne({ _id: id, institutionId: tenantId });
    if (!assessment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment not found in your institution.', 404, undefined, req);
      return;
    }

    const qIdx = assessment.questions.findIndex((q) => q.questionId === questionId);
    if (qIdx === -1 || !assessment.questions[qIdx]) {
      sendError(res, 'RESOURCE_NOT_FOUND', `Question "${questionId}" not found in this assessment.`, 404, undefined, req);
      return;
    }

    const targetQ = assessment.questions[qIdx]!;

    // Check if any student attempts have answered this question to preserve historical attempts
    const attemptsCount = await AssessmentAttempt.countDocuments({
      assessmentId: id,
      'answers.questionId': questionId,
    });

    let actionTaken = 'deleted';
    if (attemptsCount > 0) {
      // Non-destructive soft archive to preserve student grading history
      targetQ.isArchived = true;
      targetQ.updatedAt = new Date();
      actionTaken = 'archived';
    } else {
      // Safe to remove completely if never attempted
      assessment.questions.splice(qIdx, 1);
    }

    assessment.markModified('questions');
    await assessment.save();

    await recordAuditLog({
      req,
      action: actionTaken === 'archived' ? 'QUESTION_ARCHIVED' : 'QUESTION_DELETED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { questionId, prompt: targetQ.prompt, attemptsCount },
    });

    sendSuccess(res, assessment, {
      message:
        actionTaken === 'archived'
          ? 'Question archived non-destructively to preserve historical student attempt records.'
          : 'Question removed from assessment successfully.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to remove question.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Permanently delete an assessment if no student attempts exist (Faculty, College Admin, Platform Admin).
 */
export const deleteAssessmentPermanently = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid assessment ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const assessment = await Assessment.findOne({ _id: id, institutionId: tenantId }).lean();
    if (!assessment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment not found in your institution.', 404, undefined, req);
      return;
    }

    const attemptsCount = await AssessmentAttempt.countDocuments({ assessmentId: id });
    if (attemptsCount > 0) {
      sendError(
        res,
        'DEPENDENT_RESOURCES_EXIST',
        `Cannot permanently delete assessment because ${attemptsCount} student attempt(s) have been recorded. Archive the assessment to preserve grading history.`,
        409,
        {
          totalDependencies: attemptsCount,
          assessmentAttempts: attemptsCount,
        },
        req
      );
      return;
    }

    await Assessment.findOneAndDelete({ _id: id, institutionId: tenantId });

    await recordAuditLog({
      req,
      action: 'ASSESSMENT_DELETED_PERMANENTLY',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { title: assessment.title, type: assessment.type },
    });

    sendSuccess(
      res,
      { deletedId: id, title: assessment.title },
      { message: `Assessment "${assessment.title}" has been permanently deleted.` }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to permanently delete assessment.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * RAG-based Assessment Question Generation:
 * Generates grounded questions strictly from an approved, indexed learning resource.
 * All generated questions are initially marked as 'draft'.
 */
export const generateAssessmentQuestions = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const facultyUserId = req.user?.id;
  const { resourceId, experimentId, type = 'initial_diagnostic', count = 5, difficulty = 'all', topicFocus } = req.body;

  if (!resourceId || !experimentId) {
    sendError(res, 'VALIDATION_FAILED', 'resourceId and experimentId are required.', 400, undefined, req);
    return;
  }

  if (!isValidObjectId(resourceId) || !isValidObjectId(experimentId)) {
    sendError(res, 'INVALID_ID', 'Invalid resourceId or experimentId format.', 400, undefined, req);
    return;
  }

  if (!facultyUserId || !tenantId) {
    sendError(res, 'UNAUTHORIZED', 'Faculty user identity and institution context are required.', 401, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const experiment = await Experiment.findOne({ _id: experimentId, institutionId: tenantId }).lean();
    if (!experiment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Experiment not found in your institution.', 404, undefined, req);
      return;
    }

    const questionCount = Math.max(1, Math.min(15, Number(count) || 5));

    // Call RAG question generator
    const result = await generateAssessmentQuestionsFromResource({
      resourceId,
      institutionId: tenantId,
      experimentId,
      facultyUserId,
      count: questionCount,
      difficulty,
      topicFocus: typeof topicFocus === 'string' ? topicFocus.trim() : undefined,
    });

    // Check if assessment already exists for this experiment and type
    let assessment = await Assessment.findOne({
      experimentId,
      institutionId: tenantId,
      type: type as AssessmentType,
    });

    if (assessment) {
      // Append generated draft questions to existing assessment without overwriting
      assessment.questions.push(...result.questions);
      assessment.version = (assessment.version || 1) + 1;
      assessment.markModified('questions');
      await assessment.save();
    } else {
      // Create new draft assessment
      assessment = await Assessment.create({
        institutionId: tenantId,
        experimentId,
        type: type as AssessmentType,
        title: `${experiment.title} - ${type === 'initial_diagnostic' ? 'Diagnostic' : 'Summative'} Assessment`,
        description: `RAG-assisted assessment questions generated from approved document "${result.resource.title}".`,
        passingScorePercent: 60,
        timeLimitMins: 20,
        questions: result.questions,
        status: 'draft', // MUST initially be draft
        authorFacultyUserId: facultyUserId,
        version: 1,
      });
    }

    await recordAuditLog({
      req,
      action: 'RAG_QUESTIONS_GENERATED',
      targetDomain: 'curriculum',
      targetResourceId: assessment._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: {
        resourceId,
        resourceTitle: result.resource.title,
        experimentId,
        generatedCount: result.questions.length,
      },
    });

    sendSuccess(
      res,
      {
        assessment,
        generatedQuestions: result.questions,
        resource: result.resource,
      },
      { message: `Generated ${result.questions.length} draft question(s) strictly grounded in "${result.resource.title}".` },
      201
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to generate questions from learning resource.';
    sendError(res, 'RAG_GENERATION_FAILED', msg, 400, undefined, req);
  }
};

/**
 * Update the review status of an individual question (draft / approved / rejected).
 */
export const updateQuestionStatus = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id, questionId } = req.params;
  const { status } = req.body;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid assessment ID format.', 400, undefined, req);
    return;
  }

  if (!questionId) {
    sendError(res, 'VALIDATION_FAILED', 'Question ID is required.', 400, undefined, req);
    return;
  }

  const validStatuses: QuestionApprovalStatus[] = ['draft', 'approved', 'rejected'];
  if (!validStatuses.includes(status)) {
    sendError(res, 'VALIDATION_FAILED', 'Status must be "draft", "approved", or "rejected".', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const assessment = await Assessment.findOne({ _id: id, institutionId: tenantId });
    if (!assessment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment not found in your institution.', 404, undefined, req);
      return;
    }

    const question = assessment.questions.find((q) => q.questionId === questionId);
    if (!question) {
      sendError(res, 'RESOURCE_NOT_FOUND', `Question "${questionId}" not found in this assessment.`, 404, undefined, req);
      return;
    }

    question.status = status;
    question.updatedAt = new Date();
    assessment.markModified('questions');
    await assessment.save();

    await recordAuditLog({
      req,
      action: 'QUESTION_STATUS_UPDATED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { questionId, status },
    });

    sendSuccess(
      res,
      { assessment, question },
      { message: `Question status updated to ${status}.` }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update question status.';
    sendError(res, 'UPDATE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Approve all pending draft questions in an assessment in bulk.
 */
export const approveAllDraftQuestions = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid assessment ID format.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const assessment = await Assessment.findOne({ _id: id, institutionId: tenantId });
    if (!assessment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Assessment not found in your institution.', 404, undefined, req);
      return;
    }

    let approvedCount = 0;
    for (const q of assessment.questions) {
      if (q.status === 'draft' && !q.isArchived) {
        q.status = 'approved';
        q.updatedAt = new Date();
        approvedCount++;
      }
    }

    if (approvedCount > 0) {
      assessment.markModified('questions');
      await assessment.save();
    }

    await recordAuditLog({
      req,
      action: 'QUESTIONS_BULK_APPROVED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { approvedCount },
    });

    sendSuccess(
      res,
      assessment,
      { message: `Approved ${approvedCount} draft question(s) successfully.` }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to approve draft questions.';
    sendError(res, 'BULK_APPROVE_FAILED', msg, 500, undefined, req);
  }
};
