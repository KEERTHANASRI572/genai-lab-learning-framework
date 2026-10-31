import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { Laboratory, ILaboratory } from '../models/Laboratory';
import { Subject } from '../models/Subject';
import { Course } from '../models/Course';
import { Department } from '../models/Department';
import { Experiment } from '../models/Experiment';
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
 * Create a new laboratory within the tenant with parent hierarchy verification.
 */
export const createLaboratory = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const {
    departmentId,
    courseId,
    subjectId,
    name,
    code,
    location,
    capacity,
    safetyProtocolRef,
    facultyInChargeUserId,
    status,
  } = req.body;

  if (!departmentId || !courseId || !name || !code) {
    sendError(
      res,
      'VALIDATION_FAILED',
      'departmentId, courseId, name, and code are required.',
      400,
      undefined,
      req
    );
    return;
  }

  if (!isValidObjectId(departmentId) || !isValidObjectId(courseId)) {
    sendError(res, 'INVALID_ID', 'departmentId and courseId must be valid ObjectIds.', 400, undefined, req);
    return;
  }
  if (subjectId && !isValidObjectId(subjectId)) {
    sendError(res, 'INVALID_ID', 'subjectId must be a valid ObjectId when provided.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    // Verify course belongs to this tenant
    const course = await Course.findOne({ _id: courseId, institutionId: tenantId }).lean();
    if (!course) {
      sendError(res, 'PARENT_TENANT_MISMATCH', 'Target course does not belong to your institution.', 400, undefined, req);
      return;
    }

    // Verify department belongs to this tenant and matches course hierarchy
    const dept = await Department.findOne({ _id: departmentId, institutionId: tenantId }).lean();
    if (!dept || course.departmentId.toString() !== departmentId.toString()) {
      sendError(res, 'HIERARCHY_MISMATCH', 'Target department does not match the course hierarchy.', 400, undefined, req);
      return;
    }

    // Optional legacy subject check if supplied
    if (subjectId) {
      const subject = await Subject.findOne({ _id: subjectId, institutionId: tenantId }).lean();
      if (!subject || subject.courseId.toString() !== courseId.toString()) {
        sendError(res, 'HIERARCHY_MISMATCH', 'Target subject does not match the course hierarchy.', 400, undefined, req);
        return;
      }
    }

    const laboratory: ILaboratory = await Laboratory.create({
      institutionId: tenantId,
      departmentId,
      courseId,
      subjectId: subjectId || undefined,
      name,
      code,
      location,
      capacity: capacity || 40,
      safetyProtocolRef,
      facultyInChargeUserId: isValidObjectId(facultyInChargeUserId) ? facultyInChargeUserId : undefined,
      status: status || 'active',
    });

    await recordAuditLog({
      req,
      action: 'LABORATORY_CREATED',
      targetDomain: 'resource',
      targetResourceId: laboratory._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: { name: laboratory.name, code: laboratory.code, subjectId },
    });

    sendSuccess(res, laboratory, { message: 'Laboratory created successfully.' }, 201);
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(
        res,
        'DUPLICATE_RESOURCE',
        `Laboratory code '${code}' already exists for this subject.`,
        409,
        undefined,
        req
      );
      return;
    }
    sendError(res, 'VALIDATION_FAILED', mongoErr.message || 'Failed to create laboratory.', 400, undefined, req);
  }
};

/**
 * List laboratories within tenant with pagination and filters.
 */
export const listLaboratories = async (req: Request, res: Response): Promise<void> => {
  if (!ensureDatabaseReady(req, res)) return;

  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter: Record<string, unknown> = { institutionId: tenantId };

  if (req.query['courseId']) {
    if (!isValidObjectId(req.query['courseId'])) {
      sendError(res, 'INVALID_ID', 'courseId is invalid.', 400, undefined, req);
      return;
    }
    filter['courseId'] = req.query['courseId'];
  }
  if (req.query['subjectId']) {
    if (!isValidObjectId(req.query['subjectId'])) {
      sendError(res, 'INVALID_ID', 'subjectId is invalid.', 400, undefined, req);
      return;
    }
    filter['subjectId'] = req.query['subjectId'];
  }
  if (req.query['departmentId']) {
    if (!isValidObjectId(req.query['departmentId'])) {
      sendError(res, 'INVALID_ID', 'departmentId is invalid.', 400, undefined, req);
      return;
    }
    filter['departmentId'] = req.query['departmentId'];
  }
  if (req.query['status']) {
    filter['status'] = String(req.query['status']);
  }
  if (req.query['search']) {
    const regex = new RegExp(String(req.query['search']).trim(), 'i');
    filter['$or'] = [{ name: regex }, { code: regex }, { location: regex }];
  }

  try {
    const [laboratories, totalRecords] = await Promise.all([
      Laboratory.find(filter)
        .populate('subjectId', 'name code')
        .populate('courseId', 'name code')
        .populate('departmentId', 'name code')
        .sort({ code: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Laboratory.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    sendPaginated(res, laboratories, {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve laboratories.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Get laboratory by ID within tenant.
 */
export const getLaboratoryById = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid laboratory ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const lab = await Laboratory.findOne({ _id: id, institutionId: tenantId })
      .populate('subjectId', 'name code')
      .populate('courseId', 'name code')
      .populate('departmentId', 'name code')
      .lean();

    if (!lab) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Laboratory not found in your institution.', 404, undefined, req);
      return;
    }

    sendSuccess(res, lab);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve laboratory.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Update laboratory details within tenant.
 */
export const updateLaboratory = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid laboratory ID.', 400, undefined, req);
    return;
  }

  const { name, code, location, capacity, safetyProtocolRef, facultyInChargeUserId, status } = req.body;
  const updatePayload: Record<string, unknown> = {};

  if (name !== undefined) updatePayload['name'] = name;
  if (code !== undefined) updatePayload['code'] = code;
  if (location !== undefined) updatePayload['location'] = location;
  if (capacity !== undefined) updatePayload['capacity'] = capacity;
  if (safetyProtocolRef !== undefined) updatePayload['safetyProtocolRef'] = safetyProtocolRef;
  if (status !== undefined) updatePayload['status'] = status;
  if (facultyInChargeUserId !== undefined) {
    if (facultyInChargeUserId && !isValidObjectId(facultyInChargeUserId)) {
      sendError(res, 'INVALID_ID', 'facultyInChargeUserId is invalid.', 400, undefined, req);
      return;
    }
    updatePayload['facultyInChargeUserId'] = facultyInChargeUserId;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const updated = await Laboratory.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Laboratory not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'LABORATORY_UPDATED',
      targetDomain: 'resource',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: updatePayload,
    });

    sendSuccess(res, updated, { message: 'Laboratory updated successfully.' });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(res, 'DUPLICATE_RESOURCE', 'Laboratory code already exists for this subject.', 409, undefined, req);
      return;
    }
    sendError(res, 'UPDATE_FAILED', mongoErr.message || 'Failed to update laboratory.', 400, undefined, req);
  }
};

/**
 * Soft-delete / deactivate laboratory within tenant.
 */
export const deleteLaboratory = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid laboratory ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const activeExperiments = await Experiment.countDocuments({
      institutionId: tenantId,
      laboratoryId: id,
      status: { $in: ['published', 'review_pending', 'draft'] },
    });

    if (activeExperiments > 0) {
      sendError(
        res,
        'DEPENDENCY_CONFLICT',
        `Cannot deactivate laboratory with ${activeExperiments} active experiments.`,
        400,
        { activeExperiments },
        req
      );
      return;
    }

    const updated = await Laboratory.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: { status: 'inactive' } },
      { new: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Laboratory not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'LABORATORY_DEACTIVATED',
      targetDomain: 'resource',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { status: 'inactive' },
    });

    sendSuccess(res, updated, { message: 'Laboratory has been deactivated.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to deactivate laboratory.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Permanently delete a laboratory if no experiments exist (College Admin or Platform Admin).
 */
export const deleteLaboratoryPermanently = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid laboratory ID.', 400, undefined, req);
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
    const lab = await Laboratory.findOne({ _id: id, institutionId: tenantId }, null, sessionOpt).lean();
    if (!lab) {
      if (session) await session.abortTransaction();
      sendError(res, 'RESOURCE_NOT_FOUND', 'Laboratory not found in your institution.', 404, undefined, req);
      return;
    }

    const experimentsCount = await Experiment.countDocuments({ institutionId: tenantId, laboratoryId: id }, sessionOpt);
    if (experimentsCount > 0) {
      if (session) await session.abortTransaction();
      sendError(
        res,
        'DEPENDENT_RESOURCES_EXIST',
        `Cannot permanently delete laboratory because ${experimentsCount} experiment(s) still exist. Delete or reassign child experiments first.`,
        409,
        {
          totalDependencies: experimentsCount,
          experiments: experimentsCount,
        },
        req
      );
      return;
    }

    await Laboratory.findOneAndDelete({ _id: id, institutionId: tenantId }, sessionOpt);
    if (session) await session.commitTransaction();

    await recordAuditLog({
      req,
      action: 'LABORATORY_DELETED_PERMANENTLY',
      targetDomain: 'resource',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { name: lab.name, code: lab.code },
    });

    sendSuccess(
      res,
      { deletedId: id, name: lab.name },
      { message: `Laboratory "${lab.name}" has been permanently deleted.` }
    );
  } catch (err: unknown) {
    if (session) {
      try { await session.abortTransaction(); } catch { /* ignore */ }
    }
    const msg = err instanceof Error ? err.message : 'Failed to permanently delete laboratory.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  } finally {
    if (session) session.endSession();
  }
};
