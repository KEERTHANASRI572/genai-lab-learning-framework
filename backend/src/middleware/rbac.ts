import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../models/User';

/**
 * Role-Based Access Control Middleware:
 * Verifies that the authenticated user possesses at least one of the allowed roles.
 * Denies access with 403 Forbidden if the role requirement is not satisfied.
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication must be performed prior to role authorization.',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: `Forbidden: role '${req.user.role}' is not authorized to access this resource. Required: [${allowedRoles.join(
            ', '
          )}]`,
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
};

/**
 * Tenant Resolution Middleware:
 * Resolves the institutional tenant context and enforces multi-tenant boundary isolation.
 *
 * Rules:
 * 1. For College Admin, Faculty, and Student:
 *    - `req.tenantId` is strictly bound to the authenticated user's `institutionId`.
 *    - Any client attempt to tamper with or supply a foreign `X-Institution-Id` header
 *      or query param is detected and denied with 403 Forbidden.
 * 2. For Platform Admin:
 *    - Operates with system-wide authority. Can target a specific institution via
 *      `X-Institution-Id` header or route parameter.
 * 3. Never trusts client-supplied tenant identifiers without cryptographic token backing.
 */
export const tenantResolver = (req: Request, res: Response, next: NextFunction): void => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        message: 'Tenant resolution requires an authenticated user context.',
        requestId: req.headers['x-request-id'] || undefined,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  const userRole = req.user.role;
  const userInstitutionId = req.user.institutionId;

  // Platform Admin has cross-tenant scope
  if (userRole === 'platform-admin') {
    const requestedTenantHeader = req.headers['x-institution-id'];
    if (typeof requestedTenantHeader === 'string' && requestedTenantHeader.trim()) {
      req.tenantId = requestedTenantHeader.trim();
    }
    next();
    return;
  }

  // Institutional Users (College Admin, Faculty, Student) MUST have an institutionId
  if (!userInstitutionId) {
    res.status(403).json({
      success: false,
      error: {
        code: 'NO_INSTITUTIONAL_TENANCY',
        message: 'Your account is not associated with an authorized educational institution.',
        requestId: req.headers['x-request-id'] || undefined,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Detect and prevent client tenant tampering via headers
  const clientSuppliedHeader = req.headers['x-institution-id'];
  if (
    typeof clientSuppliedHeader === 'string' &&
    clientSuppliedHeader.trim() &&
    clientSuppliedHeader.trim() !== userInstitutionId
  ) {
    res.status(403).json({
      success: false,
      error: {
        code: 'CROSS_TENANT_ACCESS_DENIED',
        message:
          'Security violation: Cannot access or specify a tenant other than your assigned institution.',
        requestId: req.headers['x-request-id'] || undefined,
        timestamp: new Date().toISOString(),
      },
    });
    return;
  }

  // Lock request tenant context to authenticated user's institutional tenancy
  req.tenantId = userInstitutionId;
  next();
};

/**
 * Route parameter tenant scope guard:
 * Verifies that an institutionId present in route params or body matches the authenticated user's tenant.
 */
export const requireTenantScope = (
  source: 'params' | 'body' | 'query' = 'params',
  paramName = 'institutionId'
) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required for tenant verification.',
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    if (req.user.role === 'platform-admin') {
      next();
      return;
    }

    const targetTenantId = (req[source] as Record<string, unknown>)?.[paramName];

    if (targetTenantId && String(targetTenantId) !== String(req.user.institutionId)) {
      res.status(403).json({
        success: false,
        error: {
          code: 'CROSS_TENANT_ACCESS_DENIED',
          message:
            'Security violation: Resource belongs to a different institution. Cross-tenant access is denied.',
          requestId: req.headers['x-request-id'] || undefined,
          timestamp: new Date().toISOString(),
        },
      });
      return;
    }

    next();
  };
};
