import crypto from 'crypto';
import { Request, Response } from 'express';
import { User, IUser, UserRole } from '../models/User';
import { Department } from '../models/Department';
import { Course } from '../models/Course';
import { Institution } from '../models/Institution';
import { AssessmentAttempt } from '../models/AssessmentAttempt';
import { LearningSession } from '../models/LearningSession';
import { Subject } from '../models/Subject';
import { Laboratory } from '../models/Laboratory';
import { Experiment } from '../models/Experiment';
import { HelpRequest } from '../models/HelpRequest';
import { hashPassword, validatePasswordStrength } from '../utils/password';
import { hashToken } from '../utils/token';
import { sendInvitationEmail } from '../utils/email';
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
 * Server-side college authorization validation for faculty and student emails.
 * Validates against approved domains and explicit approved rosters.
 */
export const validateCollegeEmailAuthorization = async (
  email: string,
  role: UserRole,
  institutionId: string
): Promise<{ authorized: boolean; reason?: string }> => {
  const institution = await Institution.findById(institutionId).lean();
  if (!institution) {
    return { authorized: false, reason: 'Target institution does not exist.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const parts = normalizedEmail.split('@');
  if (parts.length !== 2 || !parts[1]) {
    return { authorized: false, reason: 'Invalid email address format.' };
  }
  const emailDomain = parts[1];

  // 1. Check domain authorization
  const allowedDomains = [
    institution.domain.toLowerCase(),
    ...(institution.settings?.approvedEmailDomains || []).map((d) => d.toLowerCase()),
  ];

  const domainMatches = allowedDomains.some((d) => emailDomain === d || emailDomain.endsWith(`.${d}`));
  if (!domainMatches) {
    return {
      authorized: false,
      reason: `Email domain '@${emailDomain}' is not authorized by ${institution.name}. Approved domains: [${allowedDomains.join(', ')}]`,
    };
  }

  // 2. Check role-specific whitelist if defined by the college
  if (role === 'faculty') {
    const whitelist = institution.settings?.approvedFacultyEmails || [];
    if (whitelist.length > 0) {
      const isWhitelisted = whitelist.some((e) => e.toLowerCase() === normalizedEmail);
      if (!isWhitelisted) {
        return {
          authorized: false,
          reason: `Faculty email '${normalizedEmail}' is not on ${institution.name}'s approved faculty authorization roster.`,
        };
      }
    }
  } else if (role === 'student') {
    const whitelist = institution.settings?.approvedStudentEmails || [];
    if (whitelist.length > 0) {
      const isWhitelisted = whitelist.some((e) => e.toLowerCase() === normalizedEmail);
      if (!isWhitelisted) {
        return {
          authorized: false,
          reason: `Student email '${normalizedEmail}' is not on ${institution.name}'s approved student enrollment roster.`,
        };
      }
    }
  }

  return { authorized: true };
};

/**
 * Onboard / create a new user within the tenant.
 */
export const createUser = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const isPlatformAdmin = req.user?.role === 'platform-admin';

  const { name, email, password, role, departmentId, courseId, profile, status } = req.body;

  if (!name || !email || !password || !role) {
    sendError(res, 'VALIDATION_FAILED', 'Name, email, password, and role are required.', 400, undefined, req);
    return;
  }

  // College Admin cannot provision Platform Admins
  if (!isPlatformAdmin && role === 'platform-admin') {
    sendError(
      res,
      'INSUFFICIENT_PERMISSIONS',
      'College administrators are not permitted to provision Platform Admin accounts.',
      403,
      undefined,
      req
    );
    return;
  }

  // Institutional users require tenantId
  if (role !== 'platform-admin' && !tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  // Faculty must have both an assigned department and an assigned course
  if (role === 'faculty') {
    if (!departmentId) {
      sendError(res, 'VALIDATION_FAILED', 'Assigned department (departmentId) is required for faculty members.', 400, undefined, req);
      return;
    }
    if (!courseId) {
      sendError(res, 'VALIDATION_FAILED', 'Assigned course (courseId) is required for faculty members.', 400, undefined, req);
      return;
    }
  }

  // Validate password strength before database operations
  const passCheck = validatePasswordStrength(password);
  if (!passCheck.valid) {
    sendError(res, 'WEAK_PASSWORD', passCheck.message || 'Password does not meet complexity rules.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  // College-authorized email validation for institutional roles
  if (role !== 'platform-admin' && tenantId) {
    const authCheck = await validateCollegeEmailAuthorization(email, role as UserRole, tenantId);
    if (!authCheck.authorized) {
      sendError(
        res,
        'EMAIL_NOT_AUTHORIZED_BY_COLLEGE',
        authCheck.reason || 'This email is not authorized for onboarding by this institution.',
        403,
        undefined,
        req
      );
      return;
    }
  }

  // Validate department if supplied
  if (departmentId) {
    if (!isValidObjectId(departmentId)) {
      sendError(res, 'INVALID_ID', 'departmentId is invalid.', 400, undefined, req);
      return;
    }
    if (tenantId) {
      const dept = await Department.findOne({ _id: departmentId, institutionId: tenantId }).lean();
      if (!dept) {
        sendError(res, 'PARENT_TENANT_MISMATCH', 'Referenced department does not belong to your institution.', 400, undefined, req);
        return;
      }
    }
  }

  // Validate course if supplied
  if (courseId) {
    if (!isValidObjectId(courseId)) {
      sendError(res, 'INVALID_ID', 'courseId is invalid.', 400, undefined, req);
      return;
    }
    if (tenantId) {
      const courseFilter: Record<string, unknown> = { _id: courseId, institutionId: tenantId };
      if (departmentId) {
        courseFilter['departmentId'] = departmentId;
      }
      const course = await Course.findOne(courseFilter).lean();
      if (!course) {
        sendError(
          res,
          'PARENT_TENANT_MISMATCH',
          departmentId
            ? 'Referenced course does not belong to the selected department and institution.'
            : 'Referenced course does not belong to your institution.',
          400,
          undefined,
          req
        );
        return;
      }
    }
  }

  try {
    const passwordHash = await hashPassword(password);

    const userProfile = { ...(profile || {}) };
    if (role === 'student' && courseId) {
      const enrolled = userProfile.enrolledCourseIds || [];
      if (!enrolled.some((id: any) => id.toString() === courseId.toString())) {
        userProfile.enrolledCourseIds = [...enrolled, courseId];
      }
    }

    const user: IUser = await User.create({
      name,
      email: email.trim().toLowerCase(),
      passwordHash,
      role: role as UserRole,
      institutionId: role === 'platform-admin' ? undefined : tenantId,
      departmentId: departmentId || undefined,
      courseId: courseId || undefined,
      profile: userProfile,
      status: status || 'active',
    });

    const userObj = user.toObject();
    delete (userObj as { passwordHash?: string }).passwordHash;
    if (userObj.security) {
      delete (userObj.security as { activeRefreshTokenHash?: string }).activeRefreshTokenHash;
    }

    await recordAuditLog({
      req,
      action: 'USER_CREATED',
      targetDomain: 'auth',
      targetResourceId: user._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: { name: user.name, email: user.email, role: user.role },
    });

    sendSuccess(res, userObj, { message: 'User provisioned successfully.' }, 201);
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(
        res,
        'DUPLICATE_RESOURCE',
        `A user with email '${email}' already exists in this institution.`,
        409,
        undefined,
        req
      );
      return;
    }
    sendError(res, 'VALIDATION_FAILED', mongoErr.message || 'Failed to create user.', 400, undefined, req);
  }
};

/**
 * Invite a new faculty or student member to the college via expiring single-use invitation.
 */
export const inviteUser = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { name, email, role, departmentId, courseId, profile } = req.body;

  if (!name || !email || !role) {
    sendError(res, 'VALIDATION_FAILED', 'Name, email, and role are required for invitation.', 400, undefined, req);
    return;
  }

  if (role !== 'faculty' && role !== 'student') {
    sendError(res, 'INVALID_ROLE', 'Invitations can only be issued for faculty or student roles.', 400, undefined, req);
    return;
  }

  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  // Faculty must have both an assigned department and an assigned course
  if (role === 'faculty') {
    if (!departmentId) {
      sendError(res, 'VALIDATION_FAILED', 'Assigned department (departmentId) is required for faculty members.', 400, undefined, req);
      return;
    }
    if (!courseId) {
      sendError(res, 'VALIDATION_FAILED', 'Assigned course (courseId) is required for faculty members.', 400, undefined, req);
      return;
    }
  }

  if (!ensureDatabaseReady(req, res)) return;

  // College-authorized email validation
  const authCheck = await validateCollegeEmailAuthorization(email, role as UserRole, tenantId);
  if (!authCheck.authorized) {
    sendError(
      res,
      'EMAIL_NOT_AUTHORIZED_BY_COLLEGE',
      authCheck.reason || 'This email is not authorized for onboarding by this institution.',
      403,
      undefined,
      req
    );
    return;
  }

  // Validate department if supplied
  if (departmentId) {
    if (!isValidObjectId(departmentId)) {
      sendError(res, 'INVALID_ID', 'departmentId is invalid.', 400, undefined, req);
      return;
    }
    const dept = await Department.findOne({ _id: departmentId, institutionId: tenantId }).lean();
    if (!dept) {
      sendError(res, 'PARENT_TENANT_MISMATCH', 'Referenced department does not belong to your institution.', 400, undefined, req);
      return;
    }
  }

  // Validate course if supplied
  if (courseId) {
    if (!isValidObjectId(courseId)) {
      sendError(res, 'INVALID_ID', 'courseId is invalid.', 400, undefined, req);
      return;
    }
    const courseFilter: Record<string, unknown> = { _id: courseId, institutionId: tenantId };
    if (departmentId) {
      courseFilter['departmentId'] = departmentId;
    }
    const course = await Course.findOne(courseFilter).lean();
    if (!course) {
      sendError(
        res,
        'PARENT_TENANT_MISMATCH',
        departmentId
          ? 'Referenced course does not belong to the selected department and institution.'
          : 'Referenced course does not belong to your institution.',
        400,
        undefined,
        req
      );
      return;
    }
  }

  try {
    // Generate secure single-use 32-byte invitation token
    const rawInvitationToken = crypto.randomBytes(32).toString('hex');
    const invitationTokenHash = hashToken(rawInvitationToken);
    const invitationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h expiration

    // Unusable temporary hash until password setup
    const placeholderHash = await hashPassword(crypto.randomBytes(24).toString('hex') + 'Aa1!');

    const userProfile = { ...(profile || {}) };
    if (role === 'student' && courseId) {
      const enrolled = userProfile.enrolledCourseIds || [];
      if (!enrolled.some((id: any) => id.toString() === courseId.toString())) {
        userProfile.enrolledCourseIds = [...enrolled, courseId];
      }
    }

    const user: IUser = await User.create({
      name,
      email: email.trim().toLowerCase(),
      passwordHash: placeholderHash,
      role: role as UserRole,
      institutionId: tenantId,
      departmentId: departmentId || undefined,
      courseId: courseId || undefined,
      profile: userProfile,
      status: 'pending_activation',
      security: {
        failedLoginAttempts: 0,
        invitationTokenHash,
        invitationExpiresAt,
        lastInvitationSentAt: new Date(),
      },
    });

    const userObj = user.toObject();
    delete (userObj as { passwordHash?: string }).passwordHash;
    if (userObj.security) {
      delete (userObj.security as any).invitationTokenHash;
      delete (userObj.security as any).activeRefreshTokenHash;
    }

    const appBaseUrl = process.env['APP_URL'] || 'http://localhost:5173';
    const activationUrl = `${appBaseUrl}/activate?token=${rawInvitationToken}`;

    const inst = await Institution.findById(tenantId).lean();
    const institutionName = inst?.name || 'Your Institution';
    const emailResult = await sendInvitationEmail(user.email, user.name, activationUrl, institutionName);

    await recordAuditLog({
      req,
      action: 'USER_INVITED',
      targetDomain: 'auth',
      targetResourceId: user._id.toString(),
      institutionId: tenantId,
      status: 'success',
      details: { name: user.name, email: user.email, role: user.role, expiresAt: invitationExpiresAt, emailDelivered: emailResult.delivered },
    });

    sendSuccess(
      res,
      {
        user: userObj,
        emailDelivery: {
          recipient: user.email,
          delivered: emailResult.delivered,
          reason: emailResult.reason,
          error: emailResult.error,
          expiresAt: invitationExpiresAt.toISOString(),
        },
      },
      {
        message: emailResult.delivered
          ? `Invitation email successfully dispatched to ${user.email}.`
          : `User provisioned in pending activation. Email delivery failed or SMTP is not configured.`,
      },
      201
    );
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(
        res,
        'DUPLICATE_RESOURCE',
        `A user with email '${email}' already exists in this institution.`,
        409,
        undefined,
        req
      );
      return;
    }
    sendError(res, 'VALIDATION_FAILED', mongoErr.message || 'Failed to issue invitation.', 400, undefined, req);
  }
};

/**
 * Resend an invitation token to a user with pending activation.
 */
export const resendInvitation = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const isPlatformAdmin = req.user?.role === 'platform-admin';
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid user ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const filter: Record<string, unknown> = { _id: id };
    if (!isPlatformAdmin) {
      filter['institutionId'] = tenantId;
    }

    const user = await User.findOne(filter);
    if (!user) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'User not found in your institution.', 404, undefined, req);
      return;
    }

    if (user.status === 'active') {
      sendError(
        res,
        'USER_ALREADY_ACTIVE',
        'This account is already active. Password reset should be used instead of invitation resend.',
        400,
        undefined,
        req
      );
      return;
    }

    if (user.status === 'suspended') {
      sendError(
        res,
        'USER_SUSPENDED',
        'Cannot resend invitation to a suspended account. Please reactivate the account first.',
        400,
        undefined,
        req
      );
      return;
    }

    // Rate limiting: 60-second cooldown between invitation resends
    if (user.security?.lastInvitationSentAt) {
      const timeSinceLast = Date.now() - new Date(user.security.lastInvitationSentAt).getTime();
      if (timeSinceLast < 60 * 1000) {
        sendError(
          res,
          'RATE_LIMITED',
          'An invitation was recently sent to this user. Please wait 60 seconds before requesting another.',
          429,
          undefined,
          req
        );
        return;
      }
    }

    // Generate fresh single-use 32-byte invitation token
    const rawInvitationToken = crypto.randomBytes(32).toString('hex');
    const invitationTokenHash = hashToken(rawInvitationToken);
    const invitationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h

    user.security.invitationTokenHash = invitationTokenHash;
    user.security.invitationExpiresAt = invitationExpiresAt;
    user.security.lastInvitationSentAt = new Date();
    user.status = 'pending_activation';
    await user.save();

    const appBaseUrl = process.env['APP_URL'] || 'http://localhost:5173';
    const relativeActivationUrl = `/activate?token=${rawInvitationToken}`;
    const fullActivationUrl = `${appBaseUrl}${relativeActivationUrl}`;

    const inst = await Institution.findById(user.institutionId || tenantId).lean();
    const institutionName = inst?.name || 'Your Institution';
    const emailResult = await sendInvitationEmail(user.email, user.name, fullActivationUrl, institutionName);

    await recordAuditLog({
      req,
      action: 'USER_INVITATION_RESENT',
      targetDomain: 'auth',
      targetResourceId: user._id.toString(),
      institutionId: user.institutionId || tenantId,
      status: 'success',
      details: { email: user.email, expiresAt: invitationExpiresAt, emailDelivered: emailResult.delivered },
    });

    sendSuccess(
      res,
      {
        userId: user._id.toString(),
        email: user.email,
        emailDelivery: {
          recipient: user.email,
          delivered: emailResult.delivered,
          reason: emailResult.reason,
          error: emailResult.error,
          expiresAt: invitationExpiresAt.toISOString(),
        },
      },
      {
        message: emailResult.delivered
          ? `New invitation email successfully dispatched to ${user.email}.`
          : `New invitation token generated. Email delivery failed or SMTP is not configured.`,
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to resend invitation.';
    sendError(res, 'INTERNAL_ERROR', msg, 500, undefined, req);
  }
};

/**
 * List institutional users with pagination and role filters.
 */
export const listUsers = async (req: Request, res: Response): Promise<void> => {
  if (!ensureDatabaseReady(req, res)) return;

  const tenantId = req.tenantId;
  const isPlatformAdmin = req.user?.role === 'platform-admin';

  if (!isPlatformAdmin && !tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { page, limit, skip } = parsePagination(req.query, 25, 100);
  const filter: Record<string, unknown> = {};

  if (!isPlatformAdmin) {
    filter['institutionId'] = tenantId;
  } else if (req.query['institutionId']) {
    if (!isValidObjectId(req.query['institutionId'])) {
      sendError(res, 'INVALID_ID', 'institutionId query parameter is invalid.', 400, undefined, req);
      return;
    }
    filter['institutionId'] = req.query['institutionId'];
  }

  if (req.query['role']) {
    filter['role'] = String(req.query['role']);
  }
  if (req.query['departmentId']) {
    if (!isValidObjectId(req.query['departmentId'])) {
      sendError(res, 'INVALID_ID', 'departmentId query parameter is invalid.', 400, undefined, req);
      return;
    }
    filter['departmentId'] = req.query['departmentId'];
  }
  if (req.query['courseId']) {
    if (!isValidObjectId(req.query['courseId'])) {
      sendError(res, 'INVALID_ID', 'courseId query parameter is invalid.', 400, undefined, req);
      return;
    }
    filter['courseId'] = req.query['courseId'];
  }
  if (req.query['status']) {
    filter['status'] = String(req.query['status']);
  }
  if (req.query['search']) {
    const regex = new RegExp(String(req.query['search']).trim(), 'i');
    filter['$or'] = [{ name: regex }, { email: regex }];
  }

  try {
    const [users, totalRecords] = await Promise.all([
      User.find(filter)
        .select('-passwordHash')
        .populate('departmentId', 'name code')
        .populate('courseId', 'name code degreeLevel')
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    sendPaginated(res, users, {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve users.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Get user profile by ID.
 */
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const isPlatformAdmin = req.user?.role === 'platform-admin';
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid user ID.', 400, undefined, req);
    return;
  }

  // Access check: self, platform-admin, or institutional admin/faculty
  const isSelf = req.user?.id === id;
  const isStaff = req.user?.role === 'college-admin' || req.user?.role === 'faculty';

  if (!isSelf && !isPlatformAdmin && !isStaff) {
    sendError(res, 'INSUFFICIENT_PERMISSIONS', 'You are not authorized to view this user profile.', 403, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const filter: Record<string, unknown> = { _id: id };
    if (!isPlatformAdmin && !isSelf) {
      filter['institutionId'] = tenantId;
    }

    const user = await User.findOne(filter)
      .select('-passwordHash')
      .populate('departmentId', 'name code')
      .populate('courseId', 'name code degreeLevel')
      .lean();

    if (!user) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'User not found in your institution.', 404, undefined, req);
      return;
    }

    // Platform Admin confidentiality restriction: cannot view individual confidential student profile
    if (isPlatformAdmin && user.role === 'student' && !isSelf) {
      sendError(
        res,
        'CONFIDENTIAL_DATA_RESTRICTED',
        'Platform administrators do not have access to individual confidential student records.',
        403,
        undefined,
        req
      );
      return;
    }

    sendSuccess(res, user);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve user.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Update user profile or administrative account state.
 */
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const isPlatformAdmin = req.user?.role === 'platform-admin';
  const isCollegeAdmin = req.user?.role === 'college-admin';
  const isSelf = req.user?.id === req.params.id;
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid user ID.', 400, undefined, req);
    return;
  }

  if (!isSelf && !isCollegeAdmin && !isPlatformAdmin) {
    sendError(res, 'INSUFFICIENT_PERMISSIONS', 'You do not have permission to modify this user.', 403, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  const { name, role, departmentId, courseId, status, profile } = req.body;
  const updatePayload: Record<string, unknown> = {};

  if (name !== undefined) updatePayload['name'] = name;
  if (profile !== undefined) updatePayload['profile'] = profile;

  try {
    const filter: Record<string, unknown> = { _id: id };
    if (!isPlatformAdmin) {
      filter['institutionId'] = tenantId;
    }

    const targetUser = await User.findOne(filter);
    if (!targetUser) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'User not found in your institution.', 404, undefined, req);
      return;
    }

    // Administrative mutations (role, department, course, status) require College Admin or Platform Admin
    if (isCollegeAdmin || isPlatformAdmin) {
      if (role !== undefined) {
        if (!isPlatformAdmin && role === 'platform-admin') {
          sendError(res, 'INSUFFICIENT_PERMISSIONS', 'Cannot escalate role to platform-admin.', 403, undefined, req);
          return;
        }
        updatePayload['role'] = role;
      }
      if (status !== undefined) updatePayload['status'] = status;

      const effectiveRole = (role !== undefined ? role : targetUser.role) as UserRole;
      const effectiveDeptId = departmentId !== undefined ? (departmentId || undefined) : targetUser.departmentId?.toString();
      const effectiveCourseId = courseId !== undefined ? (courseId || undefined) : targetUser.courseId?.toString();

      // Faculty must have both departmentId and courseId
      if (effectiveRole === 'faculty') {
        if (!effectiveDeptId) {
          sendError(res, 'VALIDATION_FAILED', 'Assigned department is required for faculty members.', 400, undefined, req);
          return;
        }
        if (!effectiveCourseId) {
          sendError(res, 'VALIDATION_FAILED', 'Assigned course is required for faculty members.', 400, undefined, req);
          return;
        }
      }

      if (departmentId !== undefined) {
        if (departmentId) {
          if (!isValidObjectId(departmentId)) {
            sendError(res, 'INVALID_ID', 'departmentId is invalid.', 400, undefined, req);
            return;
          }
          const userTenant = tenantId || targetUser.institutionId;
          const dept = await Department.findOne({ _id: departmentId, institutionId: userTenant }).lean();
          if (!dept) {
            sendError(res, 'PARENT_TENANT_MISMATCH', 'Referenced department does not belong to your institution.', 400, undefined, req);
            return;
          }
          updatePayload['departmentId'] = departmentId;
        } else {
          updatePayload['departmentId'] = null;
        }
      }

      if (courseId !== undefined) {
        if (courseId) {
          if (!isValidObjectId(courseId)) {
            sendError(res, 'INVALID_ID', 'courseId is invalid.', 400, undefined, req);
            return;
          }
          const userTenant = tenantId || targetUser.institutionId;
          const courseFilter: Record<string, unknown> = { _id: courseId, institutionId: userTenant };
          if (effectiveDeptId) {
            courseFilter['departmentId'] = effectiveDeptId;
          }
          const course = await Course.findOne(courseFilter).lean();
          if (!course) {
            sendError(
              res,
              'PARENT_TENANT_MISMATCH',
              effectiveDeptId
                ? 'Referenced course does not belong to the selected department and institution.'
                : 'Referenced course does not belong to your institution.',
              400,
              undefined,
              req
            );
            return;
          }
          updatePayload['courseId'] = courseId;
        } else {
          updatePayload['courseId'] = null;
        }
      }
    }

    const updated = await User.findOneAndUpdate(
      filter,
      { $set: updatePayload },
      { new: true, runValidators: true }
    )
      .select('-passwordHash')
      .populate('departmentId', 'name code')
      .populate('courseId', 'name code degreeLevel')
      .lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'User not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'USER_UPDATED',
      targetDomain: 'auth',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: updatePayload,
    });

    sendSuccess(res, updated, { message: 'User updated successfully.' });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(res, 'DUPLICATE_RESOURCE', 'Email already exists.', 409, undefined, req);
      return;
    }
    sendError(res, 'UPDATE_FAILED', mongoErr.message || 'Failed to update user.', 400, undefined, req);
  }
};

/**
 * Soft-delete / suspend user within tenant.
 */
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const isPlatformAdmin = req.user?.role === 'platform-admin';
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid user ID.', 400, undefined, req);
    return;
  }

  // Prevent self-deletion
  if (req.user?.id === id) {
    sendError(res, 'OPERATION_NOT_PERMITTED', 'You cannot delete or suspend your own active account.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const filter: Record<string, unknown> = { _id: id };
    if (!isPlatformAdmin) {
      filter['institutionId'] = tenantId;
    }

    const updated = await User.findOneAndUpdate(
      filter,
      { $set: { status: 'suspended' } },
      { new: true }
    )
      .select('-passwordHash')
      .lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'User not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'USER_SUSPENDED',
      targetDomain: 'auth',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { status: 'suspended' },
    });

    sendSuccess(res, updated, { message: 'User account has been suspended.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to suspend user.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Reactivate a suspended user account (College Admin or Platform Admin).
 */
export const reactivateUser = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const isPlatformAdmin = req.user?.role === 'platform-admin';
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid user ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const filter: Record<string, unknown> = { _id: id };
    if (!isPlatformAdmin) {
      filter['institutionId'] = tenantId;
    }

    const updated = await User.findOneAndUpdate(
      filter,
      { $set: { status: 'active', 'security.failedLoginAttempts': 0 } },
      { new: true }
    )
      .select('-passwordHash')
      .lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'User not found in your institution.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'USER_REACTIVATED',
      targetDomain: 'auth',
      targetResourceId: id,
      institutionId: tenantId,
      status: 'success',
      details: { status: 'active' },
    });

    sendSuccess(res, updated, { message: 'User account has been reactivated successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reactivate user.';
    sendError(res, 'UPDATE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Permanently delete a user account if no historical academic attempts or active responsibilities exist.
 */
export const deleteUserPermanently = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const isPlatformAdmin = req.user?.role === 'platform-admin';
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid user ID.', 400, undefined, req);
    return;
  }

  // Prevent self-deletion
  if (req.user?.id === id) {
    sendError(res, 'OPERATION_NOT_PERMITTED', 'You cannot permanently delete your own active account.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const filter: Record<string, unknown> = { _id: id };
    if (!isPlatformAdmin) {
      filter['institutionId'] = tenantId;
    }

    const targetUser = await User.findOne(filter).lean();
    if (!targetUser) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'User not found in your institution.', 404, undefined, req);
      return;
    }

    // Role-specific dependency check
    if (targetUser.role === 'student') {
      const [attemptsCount, sessionsCount, helpRequestsCount] = await Promise.all([
        AssessmentAttempt.countDocuments({ studentId: id }),
        LearningSession.countDocuments({ studentId: id }),
        HelpRequest.countDocuments({ studentId: id }),
      ]);

      const totalStudentRecords = attemptsCount + sessionsCount + helpRequestsCount;
      if (totalStudentRecords > 0) {
        sendError(
          res,
          'DEPENDENT_RESOURCES_EXIST',
          `Cannot permanently delete student account because ${totalStudentRecords} academic assessment or learning session record(s) exist. Suspend the account instead to retain student grade history.`,
          409,
          {
            totalDependencies: totalStudentRecords,
            assessmentAttempts: attemptsCount,
            learningSessions: sessionsCount,
            helpRequests: helpRequestsCount,
          },
          req
        );
        return;
      }
    } else if (targetUser.role === 'faculty') {
      const [subjectsCount, labsCount, experimentsCount] = await Promise.all([
        Subject.countDocuments({ facultyLeadUserId: id }),
        Laboratory.countDocuments({ facultyInChargeUserId: id }),
        Experiment.countDocuments({ authorFacultyUserId: id }),
      ]);

      const totalFacultyAssocs = subjectsCount + labsCount + experimentsCount;
      if (totalFacultyAssocs > 0) {
        sendError(
          res,
          'DEPENDENT_RESOURCES_EXIST',
          `Cannot permanently delete faculty member assigned as lead or author across ${totalFacultyAssocs} curriculum entity/entities. Reassign leadership roles before deletion.`,
          409,
          {
            totalDependencies: totalFacultyAssocs,
            subjectsLed: subjectsCount,
            laboratoriesSupervised: labsCount,
            experimentsAuthored: experimentsCount,
          },
          req
        );
        return;
      }
    }

    await User.findOneAndDelete(filter);

    await recordAuditLog({
      req,
      action: 'USER_DELETED_PERMANENTLY',
      targetDomain: 'auth',
      targetResourceId: id,
      institutionId: targetUser.institutionId || tenantId,
      status: 'success',
      details: { name: targetUser.name, email: targetUser.email, role: targetUser.role },
    });

    sendSuccess(
      res,
      { deletedId: id, name: targetUser.name, email: targetUser.email },
      { message: `User "${targetUser.name}" (${targetUser.email}) permanently deleted.` }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to permanently delete user.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};
