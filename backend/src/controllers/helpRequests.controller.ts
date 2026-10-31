import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { HelpRequest, IHelpRequest } from '../models/HelpRequest';
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
 * Student submits help request for an experiment step.
 */
export const createHelpRequest = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const studentId = req.user?.id;
  const studentName = req.user?.email.split('@')[0] || 'Student';

  const { experimentId, learningSessionId, stepNumber, studentQuery, escalationReason } = req.body;

  if (!experimentId || !stepNumber || !studentQuery) {
    sendError(res, 'VALIDATION_FAILED', 'experimentId, stepNumber, and studentQuery are required.', 400, undefined, req);
    return;
  }

  if (!isValidObjectId(experimentId)) {
    sendError(res, 'INVALID_ID', 'Invalid experiment ID.', 400, undefined, req);
    return;
  }

  if (studentQuery.trim().length < 5) {
    sendError(res, 'VALIDATION_FAILED', 'studentQuery must be at least 5 characters long.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const experiment = await Experiment.findOne({ _id: experimentId, institutionId: tenantId }).lean();
    if (!experiment) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Experiment not found in your institution.', 404, undefined, req);
      return;
    }

    const helpReq: IHelpRequest = await HelpRequest.create({
      institutionId: tenantId,
      studentId,
      studentName,
      experimentId,
      experimentTitle: experiment.title,
      learningSessionId: isValidObjectId(learningSessionId) ? learningSessionId : undefined,
      assignedFacultyUserId: experiment.authorFacultyUserId,
      stepNumber: Number(stepNumber),
      studentQuery: studentQuery.trim(),
      escalationReason: escalationReason || 'student_requested',
      status: 'pending_review',
    });

    await recordAuditLog({
      req,
      action: 'HELP_REQUEST_CREATED',
      targetDomain: 'support',
      targetResourceId: helpReq._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: { experimentId, stepNumber, reason: helpReq.escalationReason },
    });

    sendSuccess(res, helpReq, { message: 'Help request submitted to assigned faculty.' }, 201);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to create help request.';
    sendError(res, 'REQUEST_ERROR', msg, 500, undefined, req);
  }
};

/**
 * List help requests within tenant:
 * Faculty sees requests for assigned experiments; Students see own requests; College Admin sees all institutional requests.
 */
export const listHelpRequests = async (req: Request, res: Response): Promise<void> => {
  if (!ensureDatabaseReady(req, res)) return;

  const tenantId = req.tenantId;
  const user = req.user;

  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'Institutional tenancy context is required.', 403, undefined, req);
    return;
  }

  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter: Record<string, unknown> = { institutionId: tenantId };

  if (user?.role === 'student') {
    filter['studentId'] = user.id;
  } else if (user?.role === 'faculty') {
    filter['$or'] = [{ assignedFacultyUserId: user.id }, { assignedFacultyUserId: { $exists: false } }];
  }

  if (req.query['status']) {
    filter['status'] = String(req.query['status']);
  }
  if (req.query['experimentId'] && isValidObjectId(req.query['experimentId'])) {
    filter['experimentId'] = req.query['experimentId'];
  }

  try {
    const [requests, totalRecords] = await Promise.all([
      HelpRequest.find(filter)
        .populate('assignedFacultyUserId', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      HelpRequest.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    sendPaginated(res, requests, {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query help requests.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Faculty or College Admin updates help request resolution status and response.
 */
export const updateHelpRequest = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const facultyUserId = req.user?.id;
  const { id } = req.params;
  const { status, facultyResponse } = req.body;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid request ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const helpReq = await HelpRequest.findOne({ _id: id, institutionId: tenantId });
    if (!helpReq) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Help request not found in your institution.', 404, undefined, req);
      return;
    }

    if (status) {
      helpReq.status = status;
    }
    if (facultyResponse) {
      helpReq.resolution = {
        facultyResponse: facultyResponse.trim(),
        resolvedByUserId: facultyUserId ? new mongoose.Types.ObjectId(facultyUserId) : undefined,
        resolvedAt: new Date(),
      };
      if (!status) {
        helpReq.status = 'responded';
      }
    }

    await helpReq.save();

    await recordAuditLog({
      req,
      action: 'HELP_REQUEST_UPDATED',
      targetDomain: 'support',
      targetResourceId: helpReq._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: { status: helpReq.status, resolvedBy: facultyUserId },
    });

    sendSuccess(res, helpReq, { message: 'Help request status updated.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to update help request.';
    sendError(res, 'UPDATE_ERROR', msg, 500, undefined, req);
  }
};
