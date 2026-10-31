import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { Course, ICourse } from '../models/Course';
import { Department } from '../models/Department';
import { Subject } from '../models/Subject';
import { Laboratory } from '../models/Laboratory';
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
 * Create a new course within the authenticated tenant after validating parent department.
 */
export const createCourse = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { departmentId, name, code, degreeLevel, totalSemesters, academicYear, description, status } = req.body;

  if (!departmentId || !name || !code) {
    sendError(res, 'VALIDATION_FAILED', 'departmentId, name, and code are required.', 400, undefined, req);
    return;
  }

  if (!isValidObjectId(departmentId)) {
    sendError(res, 'INVALID_ID', 'departmentId is not a valid ObjectId.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    // Verify parent department exists and belongs to the same tenant
    const department = await Department.findOne({ _id: departmentId, institutionId: tenantId }).lean();
    if (!department) {
      sendError(
        res,
        'PARENT_TENANT_MISMATCH',
        'Referenced department does not exist or does not belong to your institution.',
        400,
        undefined,
        req
      );
      return;
    }

    const course: ICourse = await Course.create({
      institutionId: tenantId,
      departmentId,
      name,
      code,
      degreeLevel: degreeLevel || 'undergraduate',
      totalSemesters: totalSemesters || 8,
      academicYear,
      description,
      status: status || 'active',
    });

    await recordAuditLog({
      req,
      action: 'COURSE_CREATED',
      targetDomain: 'academic',
      targetResourceId: course._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: { name: course.name, code: course.code, departmentId },
    });

    sendSuccess(res, course, { message: 'Course created successfully.' }, 201);
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(
        res,
        'DUPLICATE_RESOURCE',
        `Course code '${code}' already exists in this department.`,
        409,
        undefined,
        req
      );
      return;
    }
    sendError(res, 'VALIDATION_FAILED', mongoErr.message || 'Failed to create course.', 400, undefined, req);
  }
};

/**
 * List courses within the tenant with pagination and filters.
 */
export const listCourses = async (req: Request, res: Response): Promise<void> => {
  if (!ensureDatabaseReady(req, res)) return;

  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { page, limit, skip } = parsePagination(req.query);
  const filter: Record<string, unknown> = { institutionId: tenantId };

  if (req.query['departmentId']) {
    if (!isValidObjectId(req.query['departmentId'])) {
      sendError(res, 'INVALID_ID', 'departmentId query parameter is invalid.', 400, undefined, req);
      return;
    }
    filter['departmentId'] = req.query['departmentId'];
  }
  if (req.query['degreeLevel']) {
    filter['degreeLevel'] = String(req.query['degreeLevel']);
  }
  if (req.query['status']) {
    filter['status'] = String(req.query['status']);
  }
  if (req.query['search']) {
    const regex = new RegExp(String(req.query['search']).trim(), 'i');
    filter['$or'] = [{ name: regex }, { code: regex }];
  }

  try {
    const [courses, totalRecords] = await Promise.all([
      Course.find(filter)
        .populate('departmentId', 'name code')
        .sort({ code: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Course.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    sendPaginated(res, courses, {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve courses.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Get course by ID within the tenant.
 */
export const getCourseById = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid course ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const course = await Course.findOne({ _id: id, institutionId: tenantId })
      .populate('departmentId', 'name code')
      .lean();

    if (!course) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Course not found in your institution.', 404, undefined, req);
      return;
    }

    sendSuccess(res, course);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve course.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Update course details within the tenant.
 */
export const updateCourse = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid course ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  const { departmentId, name, code, degreeLevel, totalSemesters, academicYear, description, status } = req.body;
  const updatePayload: Record<string, unknown> = {};

  if (departmentId !== undefined) {
    if (!isValidObjectId(departmentId)) {
      sendError(res, 'INVALID_ID', 'departmentId is invalid.', 400, undefined, req);
      return;
    }
    const dept = await Department.findOne({ _id: departmentId, institutionId: tenantId }).lean();
    if (!dept) {
      sendError(res, 'PARENT_TENANT_MISMATCH', 'Target department does not belong to your institution.', 400, undefined, req);
      return;
    }
    updatePayload['departmentId'] = departmentId;
  }

  if (name !== undefined) updatePayload['name'] = name;
  if (code !== undefined) updatePayload['code'] = code;
  if (degreeLevel !== undefined) updatePayload['degreeLevel'] = degreeLevel;
  if (totalSemesters !== undefined) updatePayload['totalSemesters'] = totalSemesters;
  if (academicYear !== undefined) updatePayload['academicYear'] = academicYear;
  if (description !== undefined) updatePayload['description'] = description;
  if (status !== undefined) updatePayload['status'] = status;

  try {
    const updated = await Course.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Course not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'COURSE_UPDATED',
      targetDomain: 'academic',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: updatePayload,
    });

    sendSuccess(res, updated, { message: 'Course updated successfully.' });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(res, 'DUPLICATE_RESOURCE', 'Course code already exists in this department.', 409, undefined, req);
      return;
    }
    sendError(res, 'UPDATE_FAILED', mongoErr.message || 'Failed to update course.', 400, undefined, req);
  }
};

/**
 * Soft-delete / archive course within tenant.
 */
export const deleteCourse = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid course ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const [activeLabs, activeSubjects] = await Promise.all([
      Laboratory.countDocuments({
        institutionId: tenantId,
        courseId: id,
        status: { $in: ['active', 'maintenance'] },
      }),
      Subject.countDocuments({
        institutionId: tenantId,
        courseId: id,
        status: 'active',
      }),
    ]);

    if (activeLabs > 0 || activeSubjects > 0) {
      sendError(
        res,
        'DEPENDENCY_CONFLICT',
        `Cannot archive course with ${activeLabs} active laboratories and ${activeSubjects} active subjects.`,
        400,
        { activeLabs, activeSubjects },
        req
      );
      return;
    }

    const updated = await Course.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: { status: 'archived' } },
      { new: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Course not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'COURSE_ARCHIVED',
      targetDomain: 'academic',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { status: 'archived' },
    });

    sendSuccess(res, updated, { message: 'Course has been archived.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to archive course.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Permanently delete a course if no child laboratories or legacy subjects exist (College Admin or Platform Admin).
 */
export const deleteCoursePermanently = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid course ID.', 400, undefined, req);
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
    const course = await Course.findOne({ _id: id, institutionId: tenantId }, null, sessionOpt).lean();
    if (!course) {
      if (session) await session.abortTransaction();
      sendError(res, 'RESOURCE_NOT_FOUND', 'Course not found in your institution.', 404, undefined, req);
      return;
    }

    const [subjectsCount, labsCount] = await Promise.all([
      Subject.countDocuments({ institutionId: tenantId, courseId: id }, sessionOpt),
      Laboratory.countDocuments({ institutionId: tenantId, courseId: id }, sessionOpt),
    ]);

    const totalDependencies = subjectsCount + labsCount;
    if (totalDependencies > 0) {
      if (session) await session.abortTransaction();
      sendError(
        res,
        'DEPENDENT_RESOURCES_EXIST',
        `Cannot permanently delete course because ${totalDependencies} dependent resource(s) still exist (${labsCount} laboratories, ${subjectsCount} subjects). Delete or reassign child laboratories first.`,
        409,
        {
          totalDependencies,
          subjects: subjectsCount,
          laboratories: labsCount,
        },
        req
      );
      return;
    }

    await Course.findOneAndDelete({ _id: id, institutionId: tenantId }, sessionOpt);
    if (session) await session.commitTransaction();

    await recordAuditLog({
      req,
      action: 'COURSE_DELETED_PERMANENTLY',
      targetDomain: 'academic',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { name: course.name, code: course.code },
    });

    sendSuccess(
      res,
      { deletedId: id, name: course.name },
      { message: `Course "${course.name}" has been permanently deleted.` }
    );
  } catch (err: unknown) {
    if (session) {
      try { await session.abortTransaction(); } catch { /* ignore */ }
    }
    const msg = err instanceof Error ? err.message : 'Failed to permanently delete course.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  } finally {
    if (session) session.endSession();
  }
};
