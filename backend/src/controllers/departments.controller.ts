import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { Department, IDepartment } from '../models/Department';
import { Course } from '../models/Course';
import { Subject } from '../models/Subject';
import { User } from '../models/User';
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
 * Create a new department within the authenticated tenant.
 */
export const createDepartment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { name, code, headOfDepartment, headOfDepartmentUserId, description, status } = req.body;

  if (!name || !code) {
    sendError(res, 'VALIDATION_FAILED', 'Department name and code are required.', 400, undefined, req);
    return;
  }

  if (headOfDepartmentUserId && !isValidObjectId(headOfDepartmentUserId)) {
    sendError(res, 'INVALID_ID', 'headOfDepartmentUserId is not a valid ObjectId.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const department: IDepartment = await Department.create({
      institutionId: tenantId,
      name,
      code,
      headOfDepartment,
      headOfDepartmentUserId,
      description,
      status: status || 'active',
    });

    await recordAuditLog({
      req,
      action: 'DEPARTMENT_CREATED',
      targetDomain: 'academic',
      targetResourceId: department._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: { name: department.name, code: department.code },
    });

    sendSuccess(res, department, { message: 'Department created successfully.' }, 201);
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(
        res,
        'DUPLICATE_RESOURCE',
        `Department code '${code}' is already registered in this institution.`,
        409,
        undefined,
        req
      );
      return;
    }
    sendError(res, 'VALIDATION_FAILED', mongoErr.message || 'Failed to create department.', 400, undefined, req);
  }
};

/**
 * List departments within the authenticated tenant with pagination and filters.
 */
export const listDepartments = async (req: Request, res: Response): Promise<void> => {
  if (!ensureDatabaseReady(req, res)) return;

  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { page, limit, skip } = parsePagination(req.query, 50, 100);
  const filter: Record<string, unknown> = { institutionId: tenantId };

  if (req.query['status']) {
    filter['status'] = String(req.query['status']);
  }
  if (req.query['search']) {
    const regex = new RegExp(String(req.query['search']).trim(), 'i');
    filter['$or'] = [{ name: regex }, { code: regex }];
  }

  try {
    const [departments, totalRecords] = await Promise.all([
      Department.find(filter).sort({ code: 1 }).skip(skip).limit(limit).lean(),
      Department.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    sendPaginated(res, departments, {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve departments.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Get a specific department by ID within the tenant.
 */
export const getDepartmentById = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid department ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const department = await Department.findOne({ _id: id, institutionId: tenantId }).lean();
    if (!department) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Department not found in your institution.', 404, undefined, req);
      return;
    }

    sendSuccess(res, department);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve department.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Update a department within the tenant.
 */
export const updateDepartment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid department ID.', 400, undefined, req);
    return;
  }

  const { name, code, headOfDepartment, headOfDepartmentUserId, description, status } = req.body;
  const updatePayload: Record<string, unknown> = {};

  if (name !== undefined) updatePayload['name'] = name;
  if (code !== undefined) updatePayload['code'] = code;
  if (headOfDepartment !== undefined) updatePayload['headOfDepartment'] = headOfDepartment;
  if (headOfDepartmentUserId !== undefined) {
    if (headOfDepartmentUserId && !isValidObjectId(headOfDepartmentUserId)) {
      sendError(res, 'INVALID_ID', 'headOfDepartmentUserId is invalid.', 400, undefined, req);
      return;
    }
    updatePayload['headOfDepartmentUserId'] = headOfDepartmentUserId;
  }
  if (description !== undefined) updatePayload['description'] = description;
  if (status !== undefined) updatePayload['status'] = status;

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const updated = await Department.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Department not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'DEPARTMENT_UPDATED',
      targetDomain: 'academic',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: updatePayload,
    });

    sendSuccess(res, updated, { message: 'Department updated successfully.' });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(res, 'DUPLICATE_RESOURCE', 'Department code already exists in this institution.', 409, undefined, req);
      return;
    }
    sendError(res, 'UPDATE_FAILED', mongoErr.message || 'Failed to update department.', 400, undefined, req);
  }
};

/**
 * Soft-delete / archive a department within the tenant.
 */
export const deleteDepartment = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid department ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    // Check if active child courses exist
    const activeCoursesCount = await Course.countDocuments({
      institutionId: tenantId,
      departmentId: id,
      status: 'active',
    });

    if (activeCoursesCount > 0) {
      sendError(
        res,
        'DEPENDENCY_CONFLICT',
        `Cannot archive department. There are ${activeCoursesCount} active courses associated with it.`,
        400,
        { activeCoursesCount },
        req
      );
      return;
    }

    const updated = await Department.findOneAndUpdate(
      { _id: id, institutionId: tenantId },
      { $set: { status: 'archived' } },
      { new: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Department not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'DEPARTMENT_ARCHIVED',
      targetDomain: 'academic',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { status: 'archived' },
    });

    sendSuccess(res, updated, { message: 'Department has been archived.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to archive department.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Permanently delete a department if no dependent courses, subjects, or users exist (College Admin or Platform Admin).
 */
export const deleteDepartmentPermanently = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid department ID.', 400, undefined, req);
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
    const department = await Department.findOne({ _id: id, institutionId: tenantId }, null, sessionOpt).lean();
    if (!department) {
      if (session) await session.abortTransaction();
      sendError(res, 'RESOURCE_NOT_FOUND', 'Department not found in your institution.', 404, undefined, req);
      return;
    }

    const [coursesCount, usersCount, subjectsCount] = await Promise.all([
      Course.countDocuments({ institutionId: tenantId, departmentId: id }, sessionOpt),
      User.countDocuments({ institutionId: tenantId, departmentId: id }, sessionOpt),
      Subject.countDocuments({ institutionId: tenantId, departmentId: id }, sessionOpt),
    ]);

    const totalDependencies = coursesCount + usersCount + subjectsCount;
    if (totalDependencies > 0) {
      if (session) await session.abortTransaction();
      sendError(
        res,
        'DEPENDENT_RESOURCES_EXIST',
        `Cannot permanently delete department because ${totalDependencies} dependent resource(s) still exist (${coursesCount} courses, ${subjectsCount} subjects, ${usersCount} users). Reassign or remove dependent child records first.`,
        409,
        {
          totalDependencies,
          courses: coursesCount,
          users: usersCount,
          subjects: subjectsCount,
        },
        req
      );
      return;
    }

    await Department.findOneAndDelete({ _id: id, institutionId: tenantId }, sessionOpt);
    if (session) await session.commitTransaction();

    await recordAuditLog({
      req,
      action: 'DEPARTMENT_DELETED_PERMANENTLY',
      targetDomain: 'academic',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { name: department.name, code: department.code },
    });

    sendSuccess(
      res,
      { deletedId: id, name: department.name },
      { message: `Department "${department.name}" has been permanently deleted.` }
    );
  } catch (err: unknown) {
    if (session) {
      try { await session.abortTransaction(); } catch { /* ignore */ }
    }
    const msg = err instanceof Error ? err.message : 'Failed to permanently delete department.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  } finally {
    if (session) session.endSession();
  }
};
