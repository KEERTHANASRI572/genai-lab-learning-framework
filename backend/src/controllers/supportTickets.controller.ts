import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { SupportTicket, ISupportTicket, SupportTicketStatus, SupportTicketPriority } from '../models/SupportTicket';
import { Department } from '../models/Department';
import {
  ensureDatabaseReady,
  isValidObjectId,
  sendError,
  sendSuccess,
  recordAuditLog,
} from '../utils/apiResponse';

/**
 * Generate a unique ticket number: TKT-YYYY-XXXXX
 */
async function generateUniqueTicketNumber(): Promise<string> {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const randomSuffix = Math.floor(10000 + Math.random() * 90000);
    const candidate = `TKT-${year}-${randomSuffix}`;
    const exists = await SupportTicket.exists({ ticketNumber: candidate });
    if (!exists) return candidate;
  }
  return `TKT-${year}-${Date.now().toString().slice(-6)}`;
}

/**
 * Create a new support ticket within the caller's tenant.
 */
export const createSupportTicket = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    sendError(res, 'UNAUTHENTICATED', 'Authentication required.', 401, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  const { subject, description, departmentId, priority } = req.body;

  if (!subject || typeof subject !== 'string' || subject.trim().length < 3) {
    sendError(res, 'VALIDATION_FAILED', 'Subject must be at least 3 characters.', 400, undefined, req);
    return;
  }

  if (!description || typeof description !== 'string' || description.trim().length < 5) {
    sendError(res, 'VALIDATION_FAILED', 'Description must be at least 5 characters.', 400, undefined, req);
    return;
  }

  const validPriorities: SupportTicketPriority[] = ['low', 'medium', 'high', 'urgent'];
  const ticketPriority: SupportTicketPriority = validPriorities.includes(priority) ? priority : 'medium';

  let validatedDeptId: mongoose.Types.ObjectId | undefined = undefined;
  if (departmentId) {
    if (!isValidObjectId(departmentId)) {
      sendError(res, 'INVALID_ID', 'Invalid department ID.', 400, undefined, req);
      return;
    }
    const deptExists = await Department.findOne({ _id: departmentId, institutionId: tenantId });
    if (!deptExists) {
      sendError(res, 'DEPARTMENT_NOT_FOUND', 'Selected department does not exist in this institution.', 404, undefined, req);
      return;
    }
    validatedDeptId = deptExists._id;
  }

  try {
    const ticketNumber = await generateUniqueTicketNumber();

    const ticket: ISupportTicket = await SupportTicket.create({
      institutionId: tenantId,
      ticketNumber,
      subject: subject.trim(),
      description: description.trim(),
      departmentId: validatedDeptId,
      submittedByUserId: userId,
      priority: ticketPriority,
      status: 'open',
    });

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('departmentId', 'name code')
      .populate('submittedByUserId', 'name email role');

    recordAuditLog({
      req,
      action: 'CREATE_SUPPORT_TICKET',
      targetDomain: 'support',
      targetResourceId: (ticket._id as mongoose.Types.ObjectId).toString(),
      status: 'success',
      details: { ticketNumber, priority: ticketPriority },
    });

    sendSuccess(res, populatedTicket, { message: 'Support ticket submitted successfully.' }, 201);
  } catch (err: unknown) {
    sendError(res, 'CREATE_TICKET_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * List support tickets strictly for the authenticated tenant.
 */
export const listSupportTickets = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const query: Record<string, unknown> = { institutionId: tenantId };

    if (req.query['status']) {
      query['status'] = req.query['status'];
    }
    if (req.query['priority']) {
      query['priority'] = req.query['priority'];
    }
    if (req.query['departmentId'] && isValidObjectId(req.query['departmentId'] as string)) {
      query['departmentId'] = req.query['departmentId'];
    }

    const tickets = await SupportTicket.find(query)
      .populate('departmentId', 'name code')
      .populate('submittedByUserId', 'name email role')
      .populate('resolvedByUserId', 'name email')
      .sort({ createdAt: -1 });

    sendSuccess(res, tickets, { message: 'Support tickets retrieved successfully.' });
  } catch (err: unknown) {
    sendError(res, 'LIST_TICKETS_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * Get single ticket by ID within authenticated tenant.
 */
export const getSupportTicketById = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { ticketId } = req.params;
  if (!isValidObjectId(ticketId)) {
    sendError(res, 'INVALID_ID', 'Invalid ticket ID format.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const ticket = await SupportTicket.findOne({ _id: ticketId, institutionId: tenantId })
      .populate('departmentId', 'name code')
      .populate('submittedByUserId', 'name email role')
      .populate('resolvedByUserId', 'name email');

    if (!ticket) {
      sendError(res, 'TICKET_NOT_FOUND', 'Support ticket not found.', 404, undefined, req);
      return;
    }

    sendSuccess(res, ticket, { message: 'Support ticket retrieved.' });
  } catch (err: unknown) {
    sendError(res, 'GET_TICKET_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * Update support ticket status and resolution notes.
 */
export const updateSupportTicketStatus = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { ticketId } = req.params;
  if (!isValidObjectId(ticketId)) {
    sendError(res, 'INVALID_ID', 'Invalid ticket ID format.', 400, undefined, req);
    return;
  }

  const { status, resolutionNotes } = req.body;
  const validStatuses: SupportTicketStatus[] = ['open', 'in_progress', 'resolved', 'closed'];

  if (!status || !validStatuses.includes(status)) {
    sendError(res, 'VALIDATION_FAILED', `Status must be one of: ${validStatuses.join(', ')}`, 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const ticket = await SupportTicket.findOne({ _id: ticketId, institutionId: tenantId });
    if (!ticket) {
      sendError(res, 'TICKET_NOT_FOUND', 'Support ticket not found in this institution.', 404, undefined, req);
      return;
    }

    ticket.status = status;
    if (resolutionNotes !== undefined) {
      ticket.resolutionNotes = resolutionNotes;
    }

    if (status === 'resolved' || status === 'closed') {
      ticket.resolvedAt = new Date();
      if (req.user?.id) {
        ticket.resolvedByUserId = new mongoose.Types.ObjectId(req.user.id);
      }
    }

    await ticket.save();

    const populatedTicket = await SupportTicket.findById(ticket._id)
      .populate('departmentId', 'name code')
      .populate('submittedByUserId', 'name email role')
      .populate('resolvedByUserId', 'name email');

    recordAuditLog({
      req,
      action: 'UPDATE_SUPPORT_TICKET_STATUS',
      targetDomain: 'support',
      targetResourceId: ticketId,
      status: 'success',
      details: { status, resolutionNotes },
    });

    sendSuccess(res, populatedTicket, { message: 'Support ticket updated successfully.' });
  } catch (err: unknown) {
    sendError(res, 'UPDATE_TICKET_FAILED', (err as Error).message, 500, undefined, req);
  }
};
