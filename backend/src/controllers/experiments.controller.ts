import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { Experiment, IExperiment } from '../models/Experiment';
import { Laboratory } from '../models/Laboratory';
import { Assessment } from '../models/Assessment';
import { LearningSession } from '../models/LearningSession';
import { HelpRequest } from '../models/HelpRequest';
import {
  ensureDatabaseReady,
  isValidObjectId,
  parsePagination,
  recordAuditLog,
  sendError,
  sendPaginated,
  sendSuccess,
} from '../utils/apiResponse';

/**
 * Create a new experiment within the tenant after validating parent laboratory.
 */
export const createExperiment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const {
    departmentId,
    courseId,
    subjectId,
    laboratoryId,
    title,
    code,
    description,
    objectives,
    equipment,
    prerequisites,
    safetyInstructions,
    procedureSteps,
    approvedResourceIds,
    estimatedDurationMins,
    authorFacultyUserId,
    topicTags,
    status,
  } = req.body;

  if (!laboratoryId || !title || !code) {
    sendError(
      res,
      'VALIDATION_FAILED',
      'laboratoryId, title, and code are required.',
      400,
      undefined,
      req
    );
    return;
  }

  if (!isValidObjectId(laboratoryId)) {
    sendError(res, 'INVALID_ID', 'laboratoryId must be a valid ObjectId.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    // Verify target laboratory belongs to this tenant
    const lab = await Laboratory.findOne({ _id: laboratoryId, institutionId: tenantId }).lean();
    if (!lab) {
      sendError(res, 'PARENT_TENANT_MISMATCH', 'Target laboratory does not belong to your institution.', 400, undefined, req);
      return;
    }

    // Determine author ID: defaults to logged in user for faculty
    const effectiveAuthorId =
      authorFacultyUserId && isValidObjectId(authorFacultyUserId)
        ? authorFacultyUserId
        : req.user?.id;

    if (!effectiveAuthorId) {
      sendError(res, 'VALIDATION_FAILED', 'authorFacultyUserId could not be resolved.', 400, undefined, req);
      return;
    }

    const experiment: IExperiment = await Experiment.create({
      institutionId: tenantId,
      departmentId: departmentId || lab.departmentId,
      courseId: courseId || lab.courseId,
      subjectId: subjectId || lab.subjectId || undefined,
      laboratoryId,
      title,
      code,
      description,
      objectives: objectives || [],
      equipment: equipment || [],
      prerequisites: prerequisites || [],
      safetyInstructions: safetyInstructions || [],
      procedureSteps: procedureSteps || [],
      approvedResourceIds: approvedResourceIds || [],
      estimatedDurationMins: estimatedDurationMins || 90,
      authorFacultyUserId: effectiveAuthorId,
      topicTags: topicTags || [],
      status: status || 'draft',
    });

    await recordAuditLog({
      req,
      action: 'EXPERIMENT_CREATED',
      targetDomain: 'curriculum',
      targetResourceId: experiment._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: { title: experiment.title, code: experiment.code, laboratoryId },
    });

    sendSuccess(res, experiment, { message: 'Experiment created successfully.' }, 201);
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(
        res,
        'DUPLICATE_RESOURCE',
        `Experiment code '${code}' already exists in this laboratory.`,
        409,
        undefined,
        req
      );
      return;
    }
    sendError(res, 'VALIDATION_FAILED', mongoErr.message || 'Failed to create experiment.', 400, undefined, req);
  }
};

/**
 * List experiments within tenant with role-based visibility filtering.
 * Students can ONLY view experiments with status: 'published'.
 */
export const listExperiments = async (req: Request, res: Response): Promise<void> => {
  if (!ensureDatabaseReady(req, res)) return;

  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter: Record<string, unknown> = { institutionId: tenantId };

  // Role visibility restriction
  if (req.user?.role === 'student') {
    filter['status'] = 'published';
  } else if (req.query['status']) {
    filter['status'] = String(req.query['status']);
  }

  if (req.query['laboratoryId']) {
    if (!isValidObjectId(req.query['laboratoryId'])) {
      sendError(res, 'INVALID_ID', 'laboratoryId is invalid.', 400, undefined, req);
      return;
    }
    filter['laboratoryId'] = req.query['laboratoryId'];
  }
  if (req.query['subjectId']) {
    if (!isValidObjectId(req.query['subjectId'])) {
      sendError(res, 'INVALID_ID', 'subjectId is invalid.', 400, undefined, req);
      return;
    }
    filter['subjectId'] = req.query['subjectId'];
  }
  if (req.query['search']) {
    const regex = new RegExp(String(req.query['search']).trim(), 'i');
    filter['$or'] = [{ title: regex }, { code: regex }, { topicTags: regex }];
  }

  try {
    const [experiments, totalRecords] = await Promise.all([
      Experiment.find(filter)
        .populate('laboratoryId', 'name code location')
        .populate('subjectId', 'name code')
        .populate('courseId', 'name code')
        .populate('departmentId', 'name code')
        .sort({ code: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Experiment.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    sendPaginated(res, experiments, {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve experiments.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Get experiment details by ID within tenant.
 */
export const getExperimentById = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid experiment ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const filter: Record<string, unknown> = { _id: id, institutionId: tenantId };
    if (req.user?.role === 'student') {
      filter['status'] = 'published';
    }

    const experiment = await Experiment.findOne(filter)
      .populate('laboratoryId', 'name code location safetyProtocolRef')
      .populate('subjectId', 'name code semester credits')
      .populate('courseId', 'name code degreeLevel')
      .populate('departmentId', 'name code')
      .lean();

    if (!experiment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Experiment not found or not published.', 404, undefined, req);
      return;
    }

    sendSuccess(res, experiment);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve experiment.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Update experiment details.
 */
export const updateExperiment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid experiment ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  const {
    title,
    code,
    description,
    objectives,
    equipment,
    prerequisites,
    safetyInstructions,
    procedureSteps,
    estimatedDurationMins,
    topicTags,
    status,
    laboratoryId,
    courseId,
    departmentId,
    approvedResourceIds,
  } = req.body;

  const updatePayload: Record<string, unknown> = {};
  if (title !== undefined) updatePayload['title'] = title;
  if (code !== undefined) updatePayload['code'] = code;
  if (description !== undefined) updatePayload['description'] = description;
  if (objectives !== undefined) updatePayload['objectives'] = objectives;
  if (equipment !== undefined) updatePayload['equipment'] = equipment;
  if (prerequisites !== undefined) updatePayload['prerequisites'] = prerequisites;
  if (safetyInstructions !== undefined) updatePayload['safetyInstructions'] = safetyInstructions;
  if (procedureSteps !== undefined) updatePayload['procedureSteps'] = procedureSteps;
  if (estimatedDurationMins !== undefined) updatePayload['estimatedDurationMins'] = estimatedDurationMins;
  if (topicTags !== undefined) updatePayload['topicTags'] = topicTags;
  if (status !== undefined) updatePayload['status'] = status;
  if (approvedResourceIds !== undefined) {
    updatePayload['approvedResourceIds'] = Array.isArray(approvedResourceIds)
      ? approvedResourceIds.filter((rid) => isValidObjectId(rid)).map((rid) => new mongoose.Types.ObjectId(rid))
      : [];
  }

  try {
    if (laboratoryId !== undefined && isValidObjectId(laboratoryId)) {
      const lab = await Laboratory.findOne({ _id: laboratoryId, institutionId: tenantId }).lean();
      if (!lab) {
        sendError(res, 'PARENT_TENANT_MISMATCH', 'Target laboratory does not belong to your institution.', 400, undefined, req);
        return;
      }
      updatePayload['laboratoryId'] = new mongoose.Types.ObjectId(laboratoryId);
      if (lab.courseId) updatePayload['courseId'] = lab.courseId;
      if (lab.departmentId) updatePayload['departmentId'] = lab.departmentId;
    } else if (courseId !== undefined && isValidObjectId(courseId)) {
      updatePayload['courseId'] = new mongoose.Types.ObjectId(courseId);
    }
    if (departmentId !== undefined && isValidObjectId(departmentId)) {
      updatePayload['departmentId'] = new mongoose.Types.ObjectId(departmentId);
    }
    const updated = await Experiment.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Experiment not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'EXPERIMENT_UPDATED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: updatePayload,
    });

    sendSuccess(res, updated, { message: 'Experiment updated successfully.' });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(res, 'DUPLICATE_RESOURCE', 'Experiment code already exists in this laboratory.', 409, undefined, req);
      return;
    }
    sendError(res, 'UPDATE_FAILED', mongoErr.message || 'Failed to update experiment.', 400, undefined, req);
  }
};

/**
 * Publish an experiment (transitions to published).
 */
export const publishExperiment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid experiment ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const updated = await Experiment.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: { status: 'published' } },
      { new: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Experiment not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'EXPERIMENT_PUBLISHED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { status: 'published' },
    });

    sendSuccess(res, updated, { message: 'Experiment published successfully and is now accessible to enrolled students.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to publish experiment.';
    sendError(res, 'UPDATE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Soft-delete / archive experiment within tenant.
 */
export const deleteExperiment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid experiment ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const updated = await Experiment.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: { status: 'archived' } },
      { new: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Experiment not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'EXPERIMENT_ARCHIVED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { status: 'archived' },
    });

    sendSuccess(res, updated, { message: 'Experiment has been archived.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to archive experiment.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Permanently delete an experiment if no student learning sessions or assessments exist (Faculty, College Admin, Platform Admin).
 */
export const deleteExperimentPermanently = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid experiment ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  let session: mongoose.ClientSession | null = null;
  try {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
    } catch {
      session = null;
    }

    const sessionOpt = session ? { session } : {};
    const experiment = await Experiment.findOne({ _id: id, institutionId: tenantId }, null, sessionOpt).lean();
    if (!experiment) {
      if (session) await session.abortTransaction();
      sendError(res, 'RESOURCE_NOT_FOUND', 'Experiment not found in your institution.', 404, undefined, req);
      return;
    }

    const [assessmentsCount, sessionsCount, helpRequestsCount] = await Promise.all([
      Assessment.countDocuments({ institutionId: tenantId, experimentId: id }, sessionOpt),
      LearningSession.countDocuments({ institutionId: tenantId, experimentId: id }, sessionOpt),
      HelpRequest.countDocuments({ institutionId: tenantId, experimentId: id }, sessionOpt),
    ]);

    const totalDependencies = assessmentsCount + sessionsCount + helpRequestsCount;
    if (totalDependencies > 0) {
      if (session) await session.abortTransaction();
      sendError(
        res,
        'DEPENDENT_RESOURCES_EXIST',
        `Cannot permanently delete experiment because ${totalDependencies} dependent student session(s) or assessment(s) still exist (${sessionsCount} sessions, ${assessmentsCount} assessments, ${helpRequestsCount} help requests). Archive the experiment to preserve historical learning evidence.`,
        409,
        {
          totalDependencies,
          assessments: assessmentsCount,
          learningSessions: sessionsCount,
          helpRequests: helpRequestsCount,
        },
        req
      );
      return;
    }

    await Experiment.findOneAndDelete({ _id: id, institutionId: tenantId }, sessionOpt);
    if (session) await session.commitTransaction();

    await recordAuditLog({
      req,
      action: 'EXPERIMENT_DELETED_PERMANENTLY',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { title: experiment.title, code: experiment.code },
    });

    sendSuccess(
      res,
      { deletedId: id, title: experiment.title },
      { message: `Experiment "${experiment.title}" has been permanently deleted.` }
    );
  } catch (err: unknown) {
    if (session) {
      try { await session.abortTransaction(); } catch { /* ignore */ }
    }
    const msg = err instanceof Error ? err.message : 'Failed to permanently delete experiment.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  } finally {
    if (session) session.endSession();
  }
};
