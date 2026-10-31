import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { LearningSession } from '../models/LearningSession';
import { Experiment } from '../models/Experiment';
import { Laboratory } from '../models/Laboratory';
import { LearningResource } from '../models/LearningResource';
import { LearnerProfile } from '../models/LearnerProfile';
import { AssessmentAttempt } from '../models/AssessmentAttempt';
import { ResourceChunk, IResourceChunk } from '../models/ResourceChunk';
import { generateLocalSemanticVector } from '../ingestion/embeddingProvider';
import {
  ensureDatabaseReady,
  isValidObjectId,
  sendError,
  sendSuccess,
} from '../utils/apiResponse';

/**
 * Three distinct scaffolding tiers for laboratory training.
 */
export const getScaffoldingGuidelines = (level: string, _stepTitle?: string) => {
  switch (level) {
    case 'beginner':
      return {
        tier: 'Basic / Beginner Path',
        guidance: 'Step-by-step procedural breakdown with prerequisite concept revision.',
        scaffoldingRules: [
          'Review foundational formulas and equipment terminal safety before execution.',
          'Execute calibration check and verify initial state with circuit schematic.',
          'Verify reading within tolerance before progressing to subsequent apparatus adjustments.',
        ],
        hintAssistanceLevel: 'high',
        understandingCheckFrequency: 'after_every_step',
        recommendedNextAction: 'Follow step-by-step apparatus alignment checklist.',
      };
    case 'advanced':
      return {
        tier: 'Advanced Path',
        guidance: 'Independent experimental execution with deep technical analysis and extension challenges.',
        scaffoldingRules: [
          'Formulate predictive mathematical model for theoretical response curves.',
          'Identify parasitic circuit inductances and calibration drift tolerances.',
          'Analyze non-linear edge conditions and perform comparative error propagation synthesis.',
        ],
        hintAssistanceLevel: 'minimal',
        understandingCheckFrequency: 'summative_milestones_only',
        recommendedNextAction: 'Execute independent parameter sweep and compute harmonic distortion metrics.',
      };
    case 'intermediate':
    default:
      return {
        tier: 'Intermediate Path',
        guidance: 'Application-focused guided experiment tasks with moderate practice checkpoints.',
        scaffoldingRules: [
          'Verify circuit node wiring and apply test waveform per procedure specifications.',
          'Record oscilloscope peak-to-peak amplitude and phase shift observations.',
          'Validate experimental values against standard transfer function expectations.',
        ],
        hintAssistanceLevel: 'moderate',
        understandingCheckFrequency: 'periodic_checkpoints',
        recommendedNextAction: 'Capture waveform snapshot and record transient response rise-time.',
      };
  }
};

/**
 * Get or initialize persistent Learning Session for student and experiment.
 */
export const getOrCreateSession = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const studentId = req.user?.id;
  const { experimentId } = req.params;

  if (!isValidObjectId(experimentId)) {
    sendError(res, 'INVALID_ID', 'Invalid experiment ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const experiment = await Experiment.findOne({ _id: experimentId, institutionId: tenantId }).lean();
    if (!experiment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Experiment not found in your institution.', 404, undefined, req);
      return;
    }

    if (req.user?.role === 'student' && experiment.status !== 'published') {
      sendError(res, 'ACCESS_DENIED', 'This experiment has not been published.', 403, undefined, req);
      return;
    }

    // Check for existing active or paused session
    let session = await LearningSession.findOne({
      studentId,
      experimentId,
      institutionId: tenantId,
      sessionStatus: { $in: ['in_progress', 'paused'] },
    });

    if (!session) {
      // Find latest assessment attempt to determine diagnosed level
      const latestDiagnostic = await AssessmentAttempt.findOne({
        studentId,
        experimentId,
        institutionId: tenantId,
        type: 'initial_diagnostic',
        status: 'completed',
      }).sort({ createdAt: -1 });

      const assignedLevel = latestDiagnostic?.determinedLearningLevel || 'intermediate';

      session = await LearningSession.create({
        institutionId: tenantId,
        studentId,
        experimentId,
        laboratoryId: experiment.laboratoryId,
        sessionStatus: 'in_progress',
        startedAt: new Date(),
        assignedScaffoldingLevel: assignedLevel,
        currentStepNumber: 1,
        stepProgress: (experiment.procedureSteps || []).map((step: any) => ({
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

    const currentStep = experiment.procedureSteps?.find((s: any) => s.stepNumber === session?.currentStepNumber);
    const scaffolding = getScaffoldingGuidelines(session.assignedScaffoldingLevel, currentStep?.title || '');

    sendSuccess(res, {
      session,
      experiment: {
        _id: experiment._id,
        title: experiment.title,
        code: experiment.code,
        description: experiment.description,
        objectives: experiment.objectives,
        safetyInstructions: experiment.safetyInstructions,
        equipment: experiment.equipment,
        procedureSteps: experiment.procedureSteps,
        prerequisites: experiment.prerequisites,
      },
      scaffolding,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve learning session.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Update step progress and record student observation data.
 */
export const updateSessionStep = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const studentId = req.user?.id;
  const { sessionId } = req.params;
  const { stepNumber, status, observationRecorded, verificationPassed, durationSeconds } = req.body;

  if (!isValidObjectId(sessionId)) {
    sendError(res, 'INVALID_ID', 'Invalid session ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const session = await LearningSession.findOne({
      _id: sessionId,
      institutionId: tenantId,
      studentId,
    });

    if (!session) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Learning session not found or access denied.', 404, undefined, req);
      return;
    }

    // Update matching step progress
    const step = session.stepProgress.find((p) => p.stepNumber === Number(stepNumber));
    if (step) {
      if (status) step.status = status;
      if (observationRecorded !== undefined) step.observationRecorded = observationRecorded;
      if (verificationPassed !== undefined) step.verificationPassed = verificationPassed;
      if (status === 'completed' && !step.completedAt) {
        step.completedAt = new Date();
      }
    }

    if (durationSeconds) {
      session.telemetry.totalDurationSeconds += Number(durationSeconds);
    }

    // Advance currentStepNumber if completed
    if (status === 'completed' && session.currentStepNumber === Number(stepNumber)) {
      const nextStep = session.stepProgress.find((p) => p.stepNumber === Number(stepNumber) + 1);
      if (nextStep) {
        session.currentStepNumber = nextStep.stepNumber;
        nextStep.status = 'in_progress';
        nextStep.startedAt = new Date();
      }
    }

    await session.save();
    sendSuccess(res, session, { message: 'Step progress recorded.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update step progress.';
    sendError(res, 'UPDATE_ERROR', msg, 500, undefined, req);
  }
};

function computeCosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length) return 0;
  let dot = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += (vecA[i] || 0) * (vecB[i] || 0);
  }
  return dot;
}

function computeLexicalOverlap(query: string, text: string): number {
  const queryTokens = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3);
  if (queryTokens.length === 0) return 0;
  const lower = text.toLowerCase();
  let matches = 0;
  for (const token of queryTokens) {
    if (lower.includes(token)) matches += 1;
  }
  return matches / queryTokens.length;
}

/**
 * RAG Knowledge Query & AI Tutoring:
 * Uses approved institution-specific resources and vector-indexed ResourceChunks.
 */
export const queryLabTutor = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const studentId = req.user?.id;
  const { sessionId } = req.params;
  const { studentQuery, stepNumber } = req.body;

  if (!studentQuery || typeof studentQuery !== 'string' || studentQuery.trim().length < 4) {
    sendError(res, 'VALIDATION_FAILED', 'Query prompt must be at least 4 characters long.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const session = await LearningSession.findOne({
      _id: sessionId,
      institutionId: tenantId,
      studentId,
    });

    if (!session) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Active session not found.', 404, undefined, req);
      return;
    }

    // 1. Resolve experiment context
    const experiment = await Experiment.findOne({ _id: session.experimentId, institutionId: tenantId }).lean();
    if (!experiment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Experiment not found in this institution.', 404, undefined, req);
      return;
    }

    // 2. Resolve hierarchical academic scope (Course, Laboratory, and Siblings)
    let labDoc = experiment.laboratoryId ? await Laboratory.findById(experiment.laboratoryId).lean() : null;
    const effectiveCourseId = experiment.courseId || labDoc?.courseId;
    const effectiveLaboratoryId = experiment.laboratoryId;

    // Retrieve sibling laboratories within the same course container
    let courseLabIds: any[] = [];
    if (effectiveCourseId) {
      courseLabIds = await Laboratory.find({
        institutionId: tenantId,
        courseId: effectiveCourseId,
      }).distinct('_id');
    }

    // 3. Query only institution-approved, published resources belonging strictly to this tenant
    const orConditions: any[] = [];

    // Explicit approved resources on the experiment
    if (experiment.approvedResourceIds && experiment.approvedResourceIds.length > 0) {
      const validObjIds = experiment.approvedResourceIds
        .filter((rid: any) => isValidObjectId(rid))
        .map((rid: any) => new mongoose.Types.ObjectId(rid));
      if (validObjIds.length > 0) {
        orConditions.push({ _id: { $in: validObjIds } });
      }
    }

    // Direct experiment mapping
    orConditions.push({ experimentId: experiment._id });

    // Laboratory mapping (experiment laboratory + all sibling laboratories under the course)
    const combinedLabIds = [
      ...(effectiveLaboratoryId ? [effectiveLaboratoryId] : []),
      ...(courseLabIds || []),
    ].map((id: any) => id.toString());
    const uniqueLabIds = Array.from(new Set(combinedLabIds))
      .filter((id) => isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    if (uniqueLabIds.length > 0) {
      orConditions.push({ laboratoryId: { $in: uniqueLabIds } });
    }

    // Course-level mapping
    if (effectiveCourseId && isValidObjectId(effectiveCourseId)) {
      orConditions.push({ courseId: new mongoose.Types.ObjectId(effectiveCourseId) });
    }

    const resources = (await LearningResource.find({
      institutionId: tenantId,
      approvalStatus: 'approved',
      status: 'published',
      $or: orConditions,
    }).lean()) as any[];

    // If no approved institutional resources found, return clear honest notice
    if (resources.length === 0) {
      sendSuccess(res, {
        answer: `No approved institutional courseware or verified learning resources have been configured for '${experiment.title}'. To maintain strict academic grounding, laboratory guidance is restricted to verified institutional materials. Please contact your course faculty.`,
        level: session.assignedScaffoldingLevel,
        stepNumber: session.currentStepNumber,
        sourcedReferences: [],
        safetyNotice: experiment.safetyInstructions?.[0] || 'Observe departmental laboratory safety guidelines at all times.',
      });
      return;
    }

    // 4. Query indexed vector chunks from ResourceChunk for the approved resources
    const resourceIds = resources.map((r) => r._id);
    const chunks = (await ResourceChunk.find({
      institutionId: tenantId,
      resourceId: { $in: resourceIds },
    }).lean()) as IResourceChunk[];

    if (chunks.length === 0) {
      sendSuccess(res, {
        answer: `Found ${resources.length} verified institutional resource(s) for '${experiment.title}', but document chunk indexing is currently pending. Please contact your instructor.`,
        level: session.assignedScaffoldingLevel,
        stepNumber: session.currentStepNumber,
        sourcedReferences: resources.map((r) => ({
          resourceId: r._id.toString(),
          title: r.title,
          type: r.format || 'manual',
          source: r.originalFilename || r.title,
        })),
        safetyNotice: experiment.safetyInstructions?.[0] || 'Observe departmental laboratory safety guidelines at all times.',
      });
      return;
    }

    // 5. Rank chunks using semantic cosine similarity and lexical token matching
    const queryVec = generateLocalSemanticVector(studentQuery, 768);
    const scoredChunks = chunks.map((chunk) => {
      const cos = chunk.embedding ? computeCosineSimilarity(queryVec, chunk.embedding) : 0;
      const lex = computeLexicalOverlap(studentQuery, chunk.text);
      const combined = cos * 0.6 + lex * 0.4;
      return { chunk, score: combined, cos, lex };
    });

    scoredChunks.sort((a, b) => b.score - a.score);
    const topChunks = scoredChunks.slice(0, 4);

    // 6. Synthesize grounded pedagogical response from retrieved chunks and experiment specifications
    const currentStepNum = Number(stepNumber) || session.currentStepNumber;
    const currentStep = experiment.procedureSteps?.find((s) => s.stepNumber === currentStepNum) || experiment.procedureSteps?.[0];

    // Extract sentences and lines relevant to the student query
    const queryTokens = studentQuery
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);

    const relevantPassages: string[] = [];
    for (const { chunk } of topChunks) {
      const sentences = chunk.text
        .split(/(?<=[.?!])\s+|\r?\n+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 20);
      for (const sent of sentences) {
        const lower = sent.toLowerCase();
        let matches = 0;
        for (const tok of queryTokens) {
          if (lower.includes(tok)) matches += 1;
        }
        if (matches > 0 && !relevantPassages.includes(sent)) {
          relevantPassages.push(sent);
        }
      }
    }

    let answerText = `Based on verified institutional courseware for ${experiment.title} (${experiment.code}):\n\n`;

    const isProceduralQuery = /step|procedure|start|how to|do i|run|command|execute|instruction|what to do/i.test(studentQuery);
    if (isProceduralQuery && currentStep) {
      answerText += `**Active Procedure Step ${currentStep.stepNumber}: ${currentStep.title}**\n`;
      answerText += `${currentStep.instruction}\n`;
      if (currentStep.expectedObservation) {
        answerText += `*Expected Observation:* ${currentStep.expectedObservation}\n\n`;
      } else {
        answerText += `\n`;
      }
    }

    if (relevantPassages.length > 0) {
      answerText += `**Verified Curriculum Guidance:**\n`;
      const uniquePassages = relevantPassages.slice(0, 4);
      for (const p of uniquePassages) {
        answerText += `- ${p}\n`;
      }
      answerText += `\n`;
    } else if (topChunks.length > 0 && topChunks[0]?.chunk) {
      answerText += `**Curriculum Reference Excerpt:**\n`;
      answerText += `> "${topChunks[0].chunk.text.substring(0, 250).replace(/\n/g, ' ')}..."\n\n`;
    }

    // Scaffolding recommendation based on assigned level
    const level = session.assignedScaffoldingLevel;
    answerText += `**${level.toUpperCase()} Guidance:** `;
    if (level === 'beginner') {
      answerText += `Carefully review each apparatus command syntax before execution. Ensure all prerequisite parameters are configured before verifying observations.`;
    } else if (level === 'advanced') {
      answerText += `Validate the observed system state against theoretical baselines and verify edge-case responses independently.`;
    } else {
      answerText += `Verify intermediate values at each checkpoint and record your measured observations before moving to the next step.`;
    }

    // 6. Build sourced references with chunk snippets
    const sourcedMaterials = Array.from(
      new Map(
        topChunks.map(({ chunk }) => {
          const parent = resources.find((r: any) => r._id.toString() === chunk.resourceId.toString());
          return [
            chunk.resourceId.toString(),
            {
              resourceId: chunk.resourceId.toString(),
              title: parent?.title || 'Institution Approved Courseware',
              type: parent?.format || 'manual',
              source: parent?.originalFilename || parent?.title || 'Approved Curriculum',
              passageSnippet: chunk.text.length > 180 ? chunk.text.substring(0, 180).trim() + '...' : chunk.text.trim(),
              pageNumber: chunk.pageNumber,
            },
          ];
        })
      ).values()
    );

    // 7. Record interaction in session telemetry
    session.aiInteractions.push({
      timestamp: new Date(),
      stepNumber: currentStepNum,
      queryPrompt: studentQuery.trim(),
      responseSummary: answerText.substring(0, 250),
      citedResourceIds: topChunks.map(({ chunk }) => chunk.resourceId),
      facultyEscalated: false,
    });
    session.telemetry.aiQueriesCount += 1;
    await session.save();

    sendSuccess(res, {
      answer: answerText,
      level: session.assignedScaffoldingLevel,
      stepNumber: currentStepNum,
      sourcedReferences: sourcedMaterials,
      safetyNotice: experiment.safetyInstructions?.[0] || 'Observe departmental laboratory safety guidelines at all times.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query laboratory tutor.';
    sendError(res, 'TUTOR_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Get student's historical progress across experiments.
 */
export const getStudentProgress = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const requestedStudentId = req.params['studentId'] || req.user?.id;

  // Non-staff can only see own progress
  if (req.user?.role === 'student' && requestedStudentId !== req.user.id) {
    sendError(res, 'INSUFFICIENT_PERMISSIONS', 'Students can only access their own learning progress.', 403, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const [sessions, attempts, profile] = await Promise.all([
      LearningSession.find({ studentId: requestedStudentId, institutionId: tenantId })
        .populate('experimentId', 'title code departmentId')
        .sort({ updatedAt: -1 })
        .lean(),
      AssessmentAttempt.find({ studentId: requestedStudentId, institutionId: tenantId })
        .populate('experimentId', 'title code')
        .sort({ submittedAt: -1 })
        .lean(),
      LearnerProfile.findOne({ studentId: requestedStudentId, institutionId: tenantId }).lean(),
    ]);

    sendSuccess(res, {
      studentId: requestedStudentId,
      profile,
      sessions,
      attempts,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve student progress.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};
