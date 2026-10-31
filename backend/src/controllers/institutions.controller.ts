import crypto from 'crypto';
import { Request, Response } from 'express';
import {
  Institution,
  IInstitution,
  INSTITUTION_TYPES,
  InstitutionType,
  User,
  Department,
  Course,
  Subject,
  Laboratory,
  Experiment,
  Assessment,
  LearningSession,
  LearningResource,
  HelpRequest,
} from '../models';
import { hashToken } from '../utils/token';
import { hashPassword } from '../utils/password';
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
 * Provision a new institution tenant (Platform Admin only).
 */
export const createInstitution = async (req: Request, res: Response): Promise<void> => {
  const {
    name,
    code,
    domain,
    type,
    otherInstitutionType,
    status,
    adminEmail,
    contactPhone,
    address,
    enabledModules,
    settings,
  } = req.body;

  if (!name || !code || !domain || !adminEmail) {
    sendError(
      res,
      'VALIDATION_FAILED',
      'Name, code, domain, and adminEmail are required to provision an institution.',
      400,
      undefined,
      req
    );
    return;
  }

  const normalizedType = type ? String(type).trim().toLowerCase() : 'university';
  if (!INSTITUTION_TYPES.includes(normalizedType as any)) {
    sendError(
      res,
      'VALIDATION_FAILED',
      `Invalid institution type '${type}'. Must be one of the recognized educational institution categories.`,
      400,
      { validTypes: INSTITUTION_TYPES },
      req
    );
    return;
  }

  const isOther = normalizedType === 'other' || normalizedType === 'other_institution_type';
  if (isOther && (!otherInstitutionType || typeof otherInstitutionType !== 'string' || !otherInstitutionType.trim())) {
    sendError(
      res,
      'VALIDATION_FAILED',
      'When "Other Institution Type" is selected, specifying the custom institution type is required.',
      400,
      { field: 'otherInstitutionType' },
      req
    );
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const institution: IInstitution = await Institution.create({
      name,
      code,
      domain,
      type: normalizedType as InstitutionType,
      otherInstitutionType: isOther ? otherInstitutionType.trim() : undefined,
      status: status || 'pending_activation',
      adminEmail,
      contactPhone,
      address,
      enabledModules: enabledModules || ['core', 'ai_learning', 'assessment'],
      settings,
    });

    await recordAuditLog({
      req,
      action: 'INSTITUTION_PROVISIONED',
      targetDomain: 'institution',
      targetResourceId: institution._id.toString(),
      institutionId: institution._id,
      status: 'success',
      details: { name: institution.name, code: institution.code, domain: institution.domain },
    });

    // Automatically provision initial College Admin account for this institution
    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const invitationTokenHash = hashToken(rawActivationToken);
    const invitationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h expiration
    const placeholderHash = await hashPassword(crypto.randomBytes(24).toString('hex') + 'Aa1!');

    let collegeAdmin = await User.findOne({
      institutionId: institution._id,
      email: adminEmail.trim().toLowerCase(),
    });

    if (!collegeAdmin) {
      collegeAdmin = await User.create({
        name: `${name} Administrator`,
        email: adminEmail.trim().toLowerCase(),
        passwordHash: placeholderHash,
        role: 'college-admin',
        institutionId: institution._id,
        status: 'pending_activation',
        security: {
          failedLoginAttempts: 0,
          invitationTokenHash,
          invitationExpiresAt,
          lastInvitationSentAt: new Date(),
        },
      });
    } else {
      collegeAdmin.security.invitationTokenHash = invitationTokenHash;
      collegeAdmin.security.invitationExpiresAt = invitationExpiresAt;
      collegeAdmin.security.lastInvitationSentAt = new Date();
      collegeAdmin.status = 'pending_activation';
      await collegeAdmin.save();
    }

    const appBaseUrl = process.env['APP_URL'] || 'http://localhost:5173';
    const activationUrl = `${appBaseUrl}/activate?token=${rawActivationToken}`;
    const emailResult = await sendInvitationEmail(
      collegeAdmin.email,
      collegeAdmin.name,
      activationUrl,
      institution.name
    );

    await recordAuditLog({
      req,
      action: 'COLLEGE_ADMIN_INVITED',
      targetDomain: 'auth',
      targetResourceId: collegeAdmin._id.toString(),
      institutionId: institution._id,
      status: 'success',
      details: { email: collegeAdmin.email, expiresAt: invitationExpiresAt, emailDelivered: emailResult.delivered },
    });

    sendSuccess(
      res,
      {
        institution,
        collegeAdmin: {
          id: collegeAdmin._id.toString(),
          name: collegeAdmin.name,
          email: collegeAdmin.email,
          role: collegeAdmin.role,
        },
        emailDelivery: {
          recipient: collegeAdmin.email,
          delivered: emailResult.delivered,
          reason: emailResult.reason,
          error: emailResult.error,
          expiresAt: invitationExpiresAt.toISOString(),
        },
      },
      {
        message: emailResult.delivered
          ? `Institution provisioned successfully. College Admin activation email dispatched to ${collegeAdmin.email}.`
          : `Institution provisioned successfully. College Admin account created in pending activation.`,
      },
      201
    );
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(
        res,
        'DUPLICATE_RESOURCE',
        'An institution with this tenant code or authorized domain already exists.',
        409,
        undefined,
        req
      );
      return;
    }
    sendError(res, 'VALIDATION_FAILED', mongoErr.message || 'Failed to provision institution.', 400, undefined, req);
  }
};

/**
 * List institutions with pagination and filtering (Platform Admin only).
 */
export const listInstitutions = async (req: Request, res: Response): Promise<void> => {
  if (!ensureDatabaseReady(req, res)) return;

  const { page, limit, skip } = parsePagination(req.query, 20, 100);
  const filter: Record<string, unknown> = {};

  if (req.query['status']) {
    filter['status'] = String(req.query['status']);
  }
  if (req.query['search']) {
    const regex = new RegExp(String(req.query['search']).trim(), 'i');
    filter['$or'] = [{ name: regex }, { code: regex }, { domain: regex }];
  }

  try {
    const [institutions, totalRecords] = await Promise.all([
      Institution.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Institution.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalRecords / limit) || 1;

    sendPaginated(res, institutions, {
      page,
      limit,
      totalRecords,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to query institutions.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Get an institution by ID (Platform Admin or matching Institutional user).
 */
export const getInstitutionById = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'The provided institution ID is not a valid ObjectId.', 400, undefined, req);
    return;
  }

  // Cross-tenant verification: Non-platform admins can only see their own institution
  if (req.user?.role !== 'platform-admin' && String(req.user?.institutionId) !== id) {
    sendError(
      res,
      'CROSS_TENANT_ACCESS_DENIED',
      'You are not authorized to view information for another institution.',
      403,
      undefined,
      req
    );
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const institution = await Institution.findById(id).lean();
    if (!institution) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Institution not found.', 404, undefined, req);
      return;
    }

    sendSuccess(res, institution);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to retrieve institution.';
    sendError(res, 'QUERY_ERROR', msg, 500, undefined, req);
  }
};

/**
 * Update institution configuration (Platform Admin, or College Admin for self-metadata).
 */
export const updateInstitution = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'The provided institution ID is not a valid ObjectId.', 400, undefined, req);
    return;
  }

  const isPlatformAdmin = req.user?.role === 'platform-admin';
  const isOwnCollegeAdmin = req.user?.role === 'college-admin' && String(req.user?.institutionId) === id;

  if (!isPlatformAdmin && !isOwnCollegeAdmin) {
    sendError(
      res,
      'INSUFFICIENT_PERMISSIONS',
      'You do not have permission to modify this institution.',
      403,
      undefined,
      req
    );
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const currentInst = await Institution.findById(id);
    if (!currentInst) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Institution not found.', 404, undefined, req);
      return;
    }

    // Sanitize allowed fields depending on role
    const updatePayload: Record<string, unknown> = {};
    const {
      name,
      code,
      domain,
      adminEmail,
      contactPhone,
      address,
      settings,
      status,
      enabledModules,
      type,
      otherInstitutionType,
    } = req.body;

    if (contactPhone !== undefined) updatePayload['contactPhone'] = contactPhone;
    if (address !== undefined) updatePayload['address'] = address;

    let emailDeliverySummary: {
      recipient: string;
      delivered: boolean;
      reason?: string;
      error?: string;
    } | null = null;

    if (isPlatformAdmin) {
      if (name !== undefined) {
        if (!String(name).trim()) {
          sendError(res, 'VALIDATION_FAILED', 'Institution name cannot be empty.', 400, undefined, req);
          return;
        }
        updatePayload['name'] = String(name).trim();
      }

      if (code !== undefined) {
        const normalizedCode = String(code).trim().toUpperCase();
        if (!normalizedCode) {
          sendError(res, 'VALIDATION_FAILED', 'Tenant code cannot be empty.', 400, undefined, req);
          return;
        }
        if (normalizedCode !== currentInst.code) {
          const duplicateCode = await Institution.findOne({ code: normalizedCode, _id: { $ne: id } });
          if (duplicateCode) {
            sendError(res, 'DUPLICATE_RESOURCE', `Tenant code '${normalizedCode}' is already in use.`, 409, undefined, req);
            return;
          }
          updatePayload['code'] = normalizedCode;
        }
      }

      if (domain !== undefined) {
        const normalizedDomain = String(domain).trim().toLowerCase();
        if (!normalizedDomain) {
          sendError(res, 'VALIDATION_FAILED', 'Authorized domain cannot be empty.', 400, undefined, req);
          return;
        }
        if (normalizedDomain !== currentInst.domain) {
          const duplicateDomain = await Institution.findOne({ domain: normalizedDomain, _id: { $ne: id } });
          if (duplicateDomain) {
            sendError(res, 'DUPLICATE_RESOURCE', `Domain '${normalizedDomain}' is already assigned to another institution.`, 409, undefined, req);
            return;
          }
          updatePayload['domain'] = normalizedDomain;
        }
      }

      if (status !== undefined) {
        const validStatuses = ['active', 'pending_activation', 'suspended', 'trial'];
        if (!validStatuses.includes(status)) {
          sendError(res, 'VALIDATION_FAILED', `Invalid status '${status}'.`, 400, { validStatuses }, req);
          return;
        }
        updatePayload['status'] = status;
      }

      if (type !== undefined) {
        const normalizedType = String(type).trim().toLowerCase();
        if (!INSTITUTION_TYPES.includes(normalizedType as any)) {
          sendError(
            res,
            'VALIDATION_FAILED',
            `Invalid institution type '${type}'.`,
            400,
            { validTypes: INSTITUTION_TYPES },
            req
          );
          return;
        }
        updatePayload['type'] = normalizedType;
        if (normalizedType === 'other' || normalizedType === 'other_institution_type') {
          if (!otherInstitutionType || !String(otherInstitutionType).trim()) {
            sendError(
              res,
              'VALIDATION_FAILED',
              'When "Other Institution Type" is selected, specifying the custom institution type is required.',
              400,
              { field: 'otherInstitutionType' },
              req
            );
            return;
          }
          updatePayload['otherInstitutionType'] = String(otherInstitutionType).trim();
        } else {
          updatePayload['otherInstitutionType'] = undefined;
        }
      } else if (otherInstitutionType !== undefined) {
        updatePayload['otherInstitutionType'] = String(otherInstitutionType).trim();
      }

      if (enabledModules !== undefined) updatePayload['enabledModules'] = enabledModules;
      if (settings !== undefined) updatePayload['settings'] = settings;

      // College Admin Email Change Handling
      if (adminEmail !== undefined) {
        const normalizedNewEmail = String(adminEmail).trim().toLowerCase();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalizedNewEmail)) {
          sendError(res, 'VALIDATION_FAILED', 'Invalid email address format for College Admin.', 400, undefined, req);
          return;
        }

        const normalizedCurrentEmail = (currentInst.adminEmail || '').trim().toLowerCase();
        if (normalizedNewEmail !== normalizedCurrentEmail) {
          // Check for collision with an account in a different institution
          const conflictUser = await User.findOne({
            email: normalizedNewEmail,
            institutionId: { $ne: currentInst._id },
          });

          if (conflictUser) {
            sendError(
              res,
              'DUPLICATE_RESOURCE',
              `A user with email '${normalizedNewEmail}' is already registered in another institution.`,
              409,
              undefined,
              req
            );
            return;
          }

          // Locate College Admin for this institution
          let collegeAdmin = await User.findOne({
            institutionId: currentInst._id,
            email: normalizedCurrentEmail,
            role: 'college-admin',
          });

          if (!collegeAdmin) {
            collegeAdmin = await User.findOne({
              institutionId: currentInst._id,
              role: 'college-admin',
            });
          }

          // Generate fresh activation token and invalidate previous tokens/sessions
          const rawActivationToken = crypto.randomBytes(32).toString('hex');
          const invitationTokenHash = hashToken(rawActivationToken);
          const invitationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

          if (collegeAdmin) {
            collegeAdmin.email = normalizedNewEmail;
            collegeAdmin.security.invitationTokenHash = invitationTokenHash;
            collegeAdmin.security.invitationExpiresAt = invitationExpiresAt;
            collegeAdmin.security.lastInvitationSentAt = new Date();
            collegeAdmin.security.failedLoginAttempts = 0;
            collegeAdmin.security.activeRefreshTokenHash = undefined;
            collegeAdmin.status = 'pending_activation';
            await collegeAdmin.save();
          } else {
            const placeholderHash = await hashPassword(crypto.randomBytes(24).toString('hex') + 'Aa1!');
            collegeAdmin = await User.create({
              name: `${updatePayload['name'] || currentInst.name} Administrator`,
              email: normalizedNewEmail,
              passwordHash: placeholderHash,
              role: 'college-admin',
              institutionId: currentInst._id,
              status: 'pending_activation',
              security: {
                failedLoginAttempts: 0,
                invitationTokenHash,
                invitationExpiresAt,
                lastInvitationSentAt: new Date(),
              },
            });
          }

          const appBaseUrl = process.env['APP_URL'] || 'http://localhost:5173';
          const activationUrl = `${appBaseUrl}/activate?token=${rawActivationToken}`;
          const emailResult = await sendInvitationEmail(
            collegeAdmin.email,
            collegeAdmin.name,
            activationUrl,
            (updatePayload['name'] as string) || currentInst.name
          );

          await recordAuditLog({
            req,
            action: 'COLLEGE_ADMIN_EMAIL_CHANGED',
            targetDomain: 'auth',
            targetResourceId: collegeAdmin._id.toString(),
            institutionId: currentInst._id,
            status: 'success',
            details: {
              oldEmail: normalizedCurrentEmail,
              newEmail: normalizedNewEmail,
              expiresAt: invitationExpiresAt,
              emailDelivered: emailResult.delivered,
            },
          });

          emailDeliverySummary = {
            recipient: normalizedNewEmail,
            delivered: emailResult.delivered,
            reason: emailResult.reason,
            error: emailResult.error,
          };

          updatePayload['adminEmail'] = normalizedNewEmail;
        }
      }
    } else if (isOwnCollegeAdmin && settings) {
      // College Admin can only tune non-billing settings
      updatePayload['settings.defaultAiModel'] = settings.defaultAiModel;
      updatePayload['settings.enforceTwoFactor'] = settings.enforceTwoFactor;
    }

    const updated = await Institution.findByIdAndUpdate(
      id,
      { $set: updatePayload },
      { new: true, runValidators: true }
    ).lean();

    await recordAuditLog({
      req,
      action: 'INSTITUTION_UPDATED',
      targetDomain: 'institution',
      targetResourceId: id,
      institutionId: id,
      status: 'success',
      details: updatePayload,
    });

    const responsePayload = emailDeliverySummary
      ? { ...updated, emailDelivery: emailDeliverySummary }
      : updated;

    sendSuccess(res, responsePayload, {
      message: emailDeliverySummary
        ? `Institution updated. New College Admin activation dispatched to ${emailDeliverySummary.recipient}.`
        : 'Institution updated successfully.',
    });
  } catch (err: unknown) {
    const mongoErr = err as { code?: number; message?: string };
    if (mongoErr.code === 11000) {
      sendError(res, 'DUPLICATE_RESOURCE', 'Update violates unique constraints.', 409, undefined, req);
      return;
    }
    sendError(res, 'UPDATE_FAILED', mongoErr.message || 'Failed to update institution.', 400, undefined, req);
  }
};

/**
 * Suspend an institution (Platform Admin only).
 */
export const suspendInstitution = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'The provided institution ID is not a valid ObjectId.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const updated = await Institution.findByIdAndUpdate(
      id,
      { $set: { status: 'suspended' } },
      { new: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Institution not found.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'INSTITUTION_SUSPENDED',
      targetDomain: 'institution',
      targetResourceId: id,
      institutionId: id,
      status: 'success',
      details: { status: 'suspended' },
    });

    sendSuccess(res, updated, { message: 'Institution has been suspended.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to suspend institution.';
    sendError(res, 'UPDATE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Reactivate a suspended or pending institution (Platform Admin only).
 */
export const reactivateInstitution = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'The provided institution ID is not a valid ObjectId.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const updated = await Institution.findByIdAndUpdate(
      id,
      { $set: { status: 'active' } },
      { new: true }
    ).lean();

    if (!updated) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Institution not found.', 404, undefined, req);
      return;
    }

    await recordAuditLog({
      req,
      action: 'INSTITUTION_REACTIVATED',
      targetDomain: 'institution',
      targetResourceId: id,
      institutionId: id,
      status: 'success',
      details: { status: 'active' },
    });

    sendSuccess(res, updated, { message: 'Institution has been reactivated successfully.' });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to reactivate institution.';
    sendError(res, 'UPDATE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Soft-delete / deactivate an institution (Platform Admin only).
 */
export const deleteInstitution = async (req: Request, res: Response): Promise<void> => {
  return suspendInstitution(req, res);
};

/**
 * Permanently delete a suspended institution and its un-activated residual artifacts (Platform Admin only).
 * Fails with 409 DEPENDENT_RESOURCES_EXIST if academic resources or active users exist.
 */
export const deleteInstitutionPermanently = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'The provided institution ID is not a valid ObjectId.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const institution = await Institution.findById(id).lean();
    if (!institution) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Institution not found.', 404, undefined, req);
      return;
    }

    // Must be suspended before allowing permanent deletion
    if (institution.status !== 'suspended') {
      sendError(
        res,
        'INSTITUTION_NOT_SUSPENDED',
        'Institution must be suspended before it can be permanently deleted. Please suspend the institution first.',
        400,
        { currentStatus: institution.status },
        req
      );
      return;
    }

    // Check all child dependencies across academic and user collections
    const [
      facultyCount,
      studentCount,
      departmentCount,
      courseCount,
      subjectCount,
      labCount,
      experimentCount,
      assessmentCount,
      sessionCount,
      resourceCount,
      helpCount,
    ] = await Promise.all([
      User.countDocuments({ institutionId: id, role: 'faculty' }),
      User.countDocuments({ institutionId: id, role: 'student' }),
      Department.countDocuments({ institutionId: id }),
      Course.countDocuments({ institutionId: id }),
      Subject.countDocuments({ institutionId: id }),
      Laboratory.countDocuments({ institutionId: id }),
      Experiment.countDocuments({ institutionId: id }),
      Assessment.countDocuments({ institutionId: id }),
      LearningSession.countDocuments({ institutionId: id }),
      LearningResource.countDocuments({ institutionId: id }),
      HelpRequest.countDocuments({ institutionId: id }),
    ]);

    const totalDependencies =
      facultyCount +
      studentCount +
      departmentCount +
      courseCount +
      subjectCount +
      labCount +
      experimentCount +
      assessmentCount +
      sessionCount +
      resourceCount +
      helpCount;

    if (totalDependencies > 0) {
      sendError(
        res,
        'DEPENDENT_RESOURCES_EXIST',
        `Cannot permanently delete institution because ${totalDependencies} dependent resource(s) still exist. Remove or clean up all child records first.`,
        409,
        {
          totalDependencies,
          departments: departmentCount,
          courses: courseCount,
          subjects: subjectCount,
          laboratories: labCount,
          experiments: experimentCount,
          faculty: facultyCount,
          students: studentCount,
          assessments: assessmentCount,
          learningSessions: sessionCount,
          learningResources: resourceCount,
          helpRequests: helpCount,
        },
        req
      );
      return;
    }

    // Remove any residual college-admin user accounts provisioned for this empty institution
    await User.deleteMany({ institutionId: id });

    // Permanently remove the institution document
    await Institution.findByIdAndDelete(id);

    await recordAuditLog({
      req,
      action: 'INSTITUTION_DELETED_PERMANENTLY',
      targetDomain: 'institution',
      targetResourceId: id,
      institutionId: id,
      status: 'success',
      details: {
        name: institution.name,
        code: institution.code,
        domain: institution.domain,
        adminEmail: institution.adminEmail,
      },
    });

    sendSuccess(
      res,
      { deletedId: id, name: institution.name },
      { message: `Institution "${institution.name}" has been permanently deleted.` }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to permanently delete institution.';
    sendError(res, 'DELETE_FAILED', msg, 500, undefined, req);
  }
};

/**
 * Resend activation invitation email to the College Admin for an institution.
 * POST /api/v1/institutions/:id/resend-admin-invitation (Platform Admin only)
 */
export const resendAdminInvitation = async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    sendError(res, 'INVALID_ID', 'Invalid institution ID format.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const institution = await Institution.findById(id);
    if (!institution) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Institution not found.', 404, undefined, req);
      return;
    }

    // Locate College Admin for this institution
    let collegeAdmin = await User.findOne({
      institutionId: institution._id,
      email: (institution.adminEmail || '').trim().toLowerCase(),
      role: 'college-admin',
    });

    if (!collegeAdmin) {
      collegeAdmin = await User.findOne({
        institutionId: institution._id,
        role: 'college-admin',
      });
    }

    if (!collegeAdmin) {
      sendError(
        res,
        'RESOURCE_NOT_FOUND',
        `No College Admin account found for institution "${institution.name}". Please edit the institution to set an administrator email.`,
        404,
        undefined,
        req
      );
      return;
    }

    if (collegeAdmin.status === 'active') {
      sendError(
        res,
        'ADMIN_ALREADY_ACTIVE',
        `College Admin account (${collegeAdmin.email}) is already active. Password reset should be used instead.`,
        400,
        undefined,
        req
      );
      return;
    }

    if (collegeAdmin.status === 'suspended') {
      sendError(
        res,
        'ADMIN_SUSPENDED',
        `Cannot resend invitation to a suspended administrator account. Please reactivate the account first.`,
        400,
        undefined,
        req
      );
      return;
    }

    // Rate limiting: 60-second cooldown
    if (collegeAdmin.security?.lastInvitationSentAt) {
      const timeSinceLast = Date.now() - new Date(collegeAdmin.security.lastInvitationSentAt).getTime();
      if (timeSinceLast < 60 * 1000) {
        sendError(
          res,
          'RATE_LIMITED',
          'An invitation was recently sent for this institution. Please wait 60 seconds before requesting another.',
          429,
          undefined,
          req
        );
        return;
      }
    }

    // Generate fresh single-use 32-byte invitation token
    const rawActivationToken = crypto.randomBytes(32).toString('hex');
    const invitationTokenHash = hashToken(rawActivationToken);
    const invitationExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    collegeAdmin.security.invitationTokenHash = invitationTokenHash;
    collegeAdmin.security.invitationExpiresAt = invitationExpiresAt;
    collegeAdmin.security.lastInvitationSentAt = new Date();
    collegeAdmin.status = 'pending_activation';
    await collegeAdmin.save();

    const appBaseUrl = process.env['APP_URL'] || 'http://localhost:5173';
    const activationUrl = `${appBaseUrl}/activate?token=${rawActivationToken}`;
    const emailResult = await sendInvitationEmail(
      collegeAdmin.email,
      collegeAdmin.name,
      activationUrl,
      institution.name
    );

    await recordAuditLog({
      req,
      action: 'COLLEGE_ADMIN_INVITATION_RESENT',
      targetDomain: 'auth',
      targetResourceId: collegeAdmin._id.toString(),
      institutionId: institution._id,
      status: 'success',
      details: {
        adminEmail: collegeAdmin.email,
        institutionName: institution.name,
        expiresAt: invitationExpiresAt,
        emailDelivered: emailResult.delivered,
      },
    });

    sendSuccess(
      res,
      {
        institutionId: institution._id.toString(),
        adminEmail: collegeAdmin.email,
        emailDelivery: {
          recipient: collegeAdmin.email,
          delivered: emailResult.delivered,
          reason: emailResult.reason,
          error: emailResult.error,
          expiresAt: invitationExpiresAt.toISOString(),
        },
      },
      {
        message: emailResult.delivered
          ? `College Admin activation email dispatched to ${collegeAdmin.email}.`
          : `College Admin invitation refreshed. Email delivery offline or SMTP unconfigured.`,
      }
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to resend College Admin invitation.';
    sendError(res, 'RESEND_FAILED', msg, 500, undefined, req);
  }
};
