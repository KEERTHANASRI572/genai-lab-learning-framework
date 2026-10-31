import { Request, Response } from 'express';
import { Subject, ISubject } from '../models/Subject';
import { Course } from '../models/Course';
import { Department } from '../models/Department';
import { Laboratory } from '../models/Laboratory';
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
 * Create a new subject within the tenant with parent hierarchy verification.
 */
export const createSubject = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const {
    departmentId,
    courseId,
    name,
    code,
    semester,
    credits,
    facultyLeadUserId,
    facultyLeadName,
    syllabusDescription,
    status,
  } = req.body;

  if (!departmentId || !courseId || !name || !code || semester === undefined) {
    sendError(
      res,
      'VALIDATION_FAILED',
      'departmentId, courseId, name, code, and semester are required.',
      400,
      undefined,
      req
    );
    return;
  }

  if (!isValidObjectId(departmentId) || !isValidObjectId(courseId)) {
    sendError(res, 'INVALID_ID', 'departmentId or courseId is not a valid ObjectId.', 400, undefined, req);
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

    // Verify department belongs to this tenant and matches course department
    const department = await Department.findOne({ _id: departmentId, institutionId: tenantId }).lean();
    if (!department) {
      sendError(res, 'PARENT_TENANT_MISMATCH', 'Target department does not belong to your institution.', 400, undefined, req);
      return;
    }

    if (course.departmentId.toString() !== departmentId.toString()) {
      sendError(
        res,
        'HIERARCHY_MISMATCH',
        'The specified course does not belong to the specified department.',
        400,
        undefined,
        req
      );
      return;
    }

    const subject: ISubject = await Subject.create({
      institutionId: tenantId,
      departmentId,
      courseId,
      name,
      code,
      semester,
      credits: credits !== undefined ? credits : 3,
      facultyLeadUserId: isValidObjectId(facultyLeadUserId) ? facultyLeadUserId : undefined,
      facultyLeadName,
      syllabusDescription,
      status: status || 'active',
    });

    await recordAuditLog({
      req,
      action: 'SUBJECT_CREATED',
      targetDomain: 'curriculum',
      targetResourceId: subject._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: { name: subject.name, code: subject.code, courseId },
    });

    sendSuccess(res, subject, { message: 'Subject created successfully.' }, 201);
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(
        res,
        'DUPLICATE_RESOURCE',
        `Subject code '${code}' already exists in this course.`,
        409,
        undefined,
        req
      );
      return;
    }
    sendError(res, 'VALIDATION_FAILED', mongoErr.message || 'Failed to create subject.', 400, undefined, req);
  }
};

/**
 * List subjects within the tenant with pagination and filters.
 */
export const listSubjects = async (req: Request, res: Response): Promise<void> => {
  if (!ensureDatabaseReady(req, res)) return;

  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { page, limit, skip } = parsePagination(req.query, 50, 100);
  const filter: Record<string, unknown> = { institutionId: tenantId };

  if (req.query['courseId']) {
    if (!isValidObjectId(req.query['courseId'])) {
      sendError(res, 'INVALID_ID', 'courseId query parameter is invalid.', 400, undefined, req);
      return;
    }
    filter['courseId'] = req.query['courseId'];
  }
  if (req.query['departmentId']) {
    if (!isValidObjectId(req.query['departmentId'])) {
      sendError(res, 'INVALID_ID', 'departmentId query parameter is invalid.', 400, undefined, req);
      return;
    }
    filter['departmentId'] = req.query['departmentId'];
  }
  if (req.query['semester']) {
    const sem = parseInt(String(req.query['semester']), 10);
    if (!isNaN(sem)) filter['semester'] = sem;
  }
  if (req.query['status']) {
    filter['status'] = String(req.query['status']);
  }
  if (req.query['search']) {
    const regex = new RegExp(String(req.query['search']).trim(), 'i');
    filter['$or'] = [{ name: regex }, { code: regex }];
  }

  try {
    const [subjects, totalRecords] = await Promise.all([
      Subject.find(filter)
        .populate('courseId', 'name code')
        .populate('departmentId', 'name code')
        .sort({ semester: 1, code: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Subject.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    sendPaginated(res, subjects, {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve subjects.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Get subject by ID within tenant.
 */
export const getSubjectById = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid subject ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const subject = await Subject.findOne({ _id: id, institutionId: tenantId })
      .populate('courseId', 'name code')
      .populate('departmentId', 'name code')
      .lean();

    if (!subject) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Subject not found in your institution.', 404, undefined, req);
      return;
    }

    sendSuccess(res, subject);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve subject.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Update subject details within tenant.
 */
export const updateSubject = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid subject ID.', 400, undefined, req);
    return;
  }

  const { name, code, semester, credits, facultyLeadUserId, facultyLeadName, syllabusDescription, status } = req.body;
  const updatePayload: Record<string, unknown> = {};

  if (name !== undefined) updatePayload['name'] = name;
  if (code !== undefined) updatePayload['code'] = code;
  if (semester !== undefined) updatePayload['semester'] = semester;
  if (credits !== undefined) updatePayload['credits'] = credits;
  if (facultyLeadName !== undefined) updatePayload['facultyLeadName'] = facultyLeadName;
  if (syllabusDescription !== undefined) updatePayload['syllabusDescription'] = syllabusDescription;
  if (status !== undefined) updatePayload['status'] = status;
  if (facultyLeadUserId !== undefined) {
    if (facultyLeadUserId && !isValidObjectId(facultyLeadUserId)) {
      sendError(res, 'INVALID_ID', 'facultyLeadUserId is invalid.', 400, undefined, req);
      return;
    }
    updatePayload['facultyLeadUserId'] = facultyLeadUserId;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const updated = await Subject.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Subject not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'SUBJECT_UPDATED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: updatePayload,
    });

    sendSuccess(res, updated, { message: 'Subject updated successfully.' });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(res, 'DUPLICATE_RESOURCE', 'Subject code already exists in this course.', 409, undefined, req);
      return;
    }
    sendError(res, 'UPDATE_FAILED', mongoErr.message || 'Failed to update subject.', 400, undefined, req);
  }
};

/**
 * Soft-delete / archive subject within tenant.
 */
export const deleteSubject = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid subject ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const activeLabs = await Laboratory.countDocuments({
      institutionId: tenantId,
      subjectId: id,
      status: 'active',
    });

    if (activeLabs > 0) {
      sendError(
        res,
        'DEPENDENCY_CONFLICT',
        `Cannot archive subject with ${activeLabs} active laboratories.`,
        400,
        { activeLabs },
        req
      );
      return;
    }

    const updated = await Subject.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: { status: 'archived' } },
      { new: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Subject not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'SUBJECT_ARCHIVED',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { status: 'archived' },
    });

    sendSuccess(res, updated, { message: 'Subject has been archived.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to archive subject.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Permanently delete a subject if no child laboratories or experiments exist (College Admin or Platform Admin).
 */
export const deleteSubjectPermanently = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid subject ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const subject = await Subject.findOne({ _id: id, institutionId: tenantId }).lean();
    if (!subject) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Subject not found in your institution.', 404, undefined, req);
      return;
    }

    const [labsCount, experimentsCount] = await Promise.all([
      Laboratory.countDocuments({ institutionId: tenantId, subjectId: id }),
      Experiment.countDocuments({ institutionId: tenantId, subjectId: id }),
    ]);

    const totalDependencies = labsCount + experimentsCount;
    if (totalDependencies > 0) {
      sendError(
        res,
        'DEPENDENT_RESOURCES_EXIST',
        `Cannot permanently delete subject because ${totalDependencies} dependent resource(s) still exist. Delete or reassign child laboratories and experiments first.`,
        409,
        {
          totalDependencies,
          laboratories: labsCount,
          experiments: experimentsCount,
        },
        req
      );
      return;
    }

    await Subject.findOneAndDelete({ _id: id, institutionId: tenantId });

    await recordAuditLog({
      req,
      action: 'SUBJECT_DELETED_PERMANENTLY',
      targetDomain: 'curriculum',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { name: subject.name, code: subject.code },
    });

    sendSuccess(
      res,
      { deletedId: id, name: subject.name },
      { message: `Subject "${subject.name}" has been permanently deleted.` }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to permanently delete subject.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};
