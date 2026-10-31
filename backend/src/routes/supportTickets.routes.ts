import { Router } from 'express';
import {
  createSupportTicket,
  listSupportTickets,
  getSupportTicketById,
  updateSupportTicketStatus,
} from '../controllers/supportTickets.controller';
import { authenticate } from '../middleware/auth';
import { tenantResolver, requireRole } from '../middleware/rbac';

export const supportTicketsRouter = Router();

// All ticket routes require authentication and tenant resolution
supportTicketsRouter.use(authenticate, tenantResolver);

// List tickets (accessible to college-admin, faculty, platform-admin)
supportTicketsRouter.get(
  '/',
  requireRole('college-admin', 'faculty', 'platform-admin'),
  listSupportTickets
);

// Create new ticket (accessible to college-admin, faculty, student)
supportTicketsRouter.post(
  '/',
  requireRole('college-admin', 'faculty', 'student'),
  createSupportTicket
);

// Get single ticket by ID
supportTicketsRouter.get(
  '/:ticketId',
  requireRole('college-admin', 'faculty', 'platform-admin'),
  getSupportTicketById
);

// Update ticket status (college-admin, platform-admin)
supportTicketsRouter.patch(
  '/:ticketId/status',
  requireRole('college-admin', 'platform-admin'),
  updateSupportTicketStatus
);

