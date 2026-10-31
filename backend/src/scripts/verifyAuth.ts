
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env';
import {
  hashPassword,
  verifyPassword,
  validatePasswordStrength,
} from '../utils/password';
import {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  hashToken,
} from '../utils/token';
import { authenticate } from '../middleware/auth';
import {
  requireRole,
  tenantResolver,
  requireTenantScope,
} from '../middleware/rbac';
import { login } from '../controllers/auth.controller';
import { isDatabaseConnected } from '../config/database';

function requireJwtSecret(): string {
  const secret: unknown = config.JWT_SECRET;

  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error(
      'JWT_SECRET is not configured for auth verification tests',
    );
  }

  return secret;
}

// A validated, non-optional secret for test tokens.
const jwtSecret: string = requireJwtSecret();

interface TestResult {
  suite: string;
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function recordTest(
  suite: string,
  name: string,
  passed: boolean,
  message?: string,
): void {
  results.push({ suite, name, passed, message });

  const statusSymbol = passed ? '✓' : '✗';
  console.log(`  [${statusSymbol}] ${name}${message ? ` (${message})` : ''}`);

  if (!passed) {
    console.error(`      FAIL: ${message ?? name}`);
  }
}

// Helper to create mock Express req, res, next.
function createMockHttp() {
  const req: Partial<Request> = {
    headers: {},
    params: {},
    query: {},
    body: {},
  };

  let statusCode = 200;
  let responseData: unknown = null;
  let nextCalled = false;

  const res: Partial<Response> = {
    status(code: number) {
      statusCode = code;
      return this as Response;
    },
    json(data: unknown) {
      responseData = data;
      return this as Response;
    },
    setHeader() {
      return this as Response;
    },
  };

  const next: NextFunction = () => {
    nextCalled = true;
  };

  return {
    req: req as Request,
    res: res as Response,
    next,
    getStatusCode: () => statusCode,
    getResponseData: () => responseData,
    isNextCalled: () => nextCalled,
  };
}

function getErrorCode(responseData: unknown): unknown {
  if (
    typeof responseData === 'object' &&
    responseData !== null &&
    'error' in responseData
  ) {
    const error = responseData.error;

    if (typeof error === 'object' && error !== null && 'code' in error) {
      return error.code;
    }
  }

  return undefined;
}

/**
 * Suite 1: Password Security, Complexity, and Hash Protection.
 */
async function runPasswordSecurityTests(): Promise<void> {
  console.log('\n================================================================');
  console.log('  SUITE 1: Password Complexity, Hashing, & Protection Tests');
  console.log('================================================================\n');

  const shortPass = validatePasswordStrength('Ab1!');
  recordTest(
    'Password',
    'Rejects password shorter than 8 characters',
    !shortPass.valid,
  );

  const noNumber = validatePasswordStrength('Abcdefgh!');
  recordTest(
    'Password',
    'Rejects password without numbers',
    !noNumber.valid,
  );

  const noSpecial = validatePasswordStrength('Abcdefgh1');
  recordTest(
    'Password',
    'Rejects password without special characters',
    !noSpecial.valid,
  );

  const strongPass = validatePasswordStrength('StrongPass123!');
  recordTest(
    'Password',
    'Accepts strong compliant password',
    strongPass.valid,
  );

  const plain = 'StrongPass123!';
  const hash = await hashPassword(plain);

  const isValidBcrypt =
    hash.startsWith('$2a$') || hash.startsWith('$2b$');

  recordTest(
    'Password',
    'Generates valid bcrypt hash ($2a/$2b)',
    isValidBcrypt,
  );
  recordTest('Password', 'Hash does not equal plaintext', hash !== plain);

  const verifySuccess = await verifyPassword(plain, hash);
  recordTest(
    'Password',
    'Verifies correct password against hash',
    verifySuccess,
  );

  const verifyWrong = await verifyPassword('WrongPassword123!', hash);
  recordTest(
    'Password',
    'Rejects incorrect password against hash',
    !verifyWrong,
  );

  const verifyEmpty = await verifyPassword('', hash);
  recordTest(
    'Password',
    'Rejects empty password against hash',
    !verifyEmpty,
  );
}

/**
 * Suite 2: JWT Signing, Verification, Expiry, and Algorithm Restrictions.
 */
async function runTokenSecurityTests(): Promise<void> {
  console.log('\n================================================================');
  console.log('  SUITE 2: JWT Signing, Expiry, & Algorithm Enforcement Tests');
  console.log('================================================================\n');

  const userId = new mongoose.Types.ObjectId().toString();
  const institutionId = new mongoose.Types.ObjectId().toString();

  const validToken = signAccessToken({
    sub: userId,
    email: 'student@college.edu',
    role: 'student',
    institutionId,
  });

  const decoded = verifyAccessToken(validToken);

  recordTest(
    'Tokens',
    'Decodes valid access token with correct claims',
    decoded.sub === userId &&
    decoded.role === 'student' &&
    decoded.institutionId === institutionId,
  );

  const expiredToken = jwt.sign(
    {
      sub: userId,
      email: 'student@college.edu',
      role: 'student',
      type: 'access',
    },
    jwtSecret,
    {
      algorithm: 'HS256',
      expiresIn: '-1s',
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    },
  );

  let expiredError = false;

  try {
    verifyAccessToken(expiredToken);
  } catch (err: unknown) {
    expiredError =
      err instanceof Error &&
      err.message.toLowerCase().includes('expired');
  }

  recordTest(
    'Tokens',
    'Rejects expired token and reports expiration',
    expiredError,
  );

  // Deliberately forge a "none" algorithm token for a rejection test.
  const forgedNoneToken = jwt.sign(
    {
      sub: userId,
      email: 'hacker@attack.com',
      role: 'platform-admin',
      type: 'access',
    },
    '',
    { algorithm: 'none' },
  );

  let noneAlgoRejected = false;

  try {
    verifyAccessToken(forgedNoneToken);
  } catch {
    noneAlgoRejected = true;
  }

  recordTest(
    'Tokens',
    'Strictly enforces HS256 and rejects algorithm "none"',
    noneAlgoRejected,
  );

  const tamperedToken = jwt.sign(
    {
      sub: userId,
      role: 'platform-admin',
      type: 'access',
    },
    'wrong_secret_key_that_is_32_characters_long_for_test',
    { algorithm: 'HS256' },
  );

  let tamperedRejected = false;

  try {
    verifyAccessToken(tamperedToken);
  } catch {
    tamperedRejected = true;
  }

  recordTest(
    'Tokens',
    'Rejects token signed with invalid secret key',
    tamperedRejected,
  );

  const { refreshToken, tokenId } = signRefreshToken(userId);
  const decodedRefresh = verifyRefreshToken(refreshToken);

  recordTest(
    'Tokens',
    'Signs and verifies refresh token with unique tokenId',
    decodedRefresh.sub === userId &&
    decodedRefresh.tokenId === tokenId &&
    decodedRefresh.type === 'refresh',
  );

  const hash1 = hashToken(refreshToken);
  const hash2 = hashToken(refreshToken);

  recordTest(
    'Tokens',
    'Generates deterministic SHA-256 hash for refresh token tracking',
    hash1 === hash2,
  );
}

/**
 * Suite 3: Authentication Middleware Tests.
 */
async function runAuthMiddlewareTests(): Promise<void> {
  console.log('\n================================================================');
  console.log('  SUITE 3: Authentication Middleware (Isolated Unit Tests)');
  console.log('================================================================\n');

  {
    const { req, res, next, getStatusCode, getResponseData } =
      createMockHttp();

    authenticate(req, res, next);

    recordTest(
      'Auth Middleware',
      'Denies request without Authorization header (401)',
      getStatusCode() === 401 &&
      getErrorCode(getResponseData()) === 'AUTHENTICATION_REQUIRED',
    );
  }

  {
    const { req, res, next, getStatusCode, getResponseData } =
      createMockHttp();

    req.headers.authorization = 'Basic dXNlcjpwYXNz';
    authenticate(req, res, next);

    recordTest(
      'Auth Middleware',
      'Denies non-Bearer Authorization scheme (401)',
      getStatusCode() === 401 &&
      getErrorCode(getResponseData()) === 'INVALID_TOKEN_FORMAT',
    );
  }

  {
    const { req, res, next, getStatusCode, getResponseData } =
      createMockHttp();

    const expiredToken = jwt.sign(
      {
        sub: 'user_123',
        email: 'test@college.edu',
        role: 'student',
        type: 'access',
      },
      jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: '-1s',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );

    req.headers.authorization = `Bearer ${expiredToken}`;
    authenticate(req, res, next);

    recordTest(
      'Auth Middleware',
      'Denies expired Bearer token with TOKEN_EXPIRED code (401)',
      getStatusCode() === 401 &&
      getErrorCode(getResponseData()) === 'TOKEN_EXPIRED',
    );
  }

  {
    const { req, res, next, isNextCalled } = createMockHttp();

    const validToken = signAccessToken({
      sub: 'usr_valid_42',
      email: 'student@apex.edu',
      role: 'student',
      institutionId: 'inst_apex_100',
    });

    req.headers.authorization = `Bearer ${validToken}`;
    authenticate(req, res, next);

    recordTest(
      'Auth Middleware',
      'Accepts valid Bearer token and populates req.user',
      isNextCalled() &&
      req.user?.id === 'usr_valid_42' &&
      req.user?.role === 'student',
    );
  }

  {
    const { req, res, next, isNextCalled } = createMockHttp();

    const validToken = signAccessToken({
      sub: 'usr_cookie_88',
      email: 'faculty@apex.edu',
      role: 'faculty',
      institutionId: 'inst_apex_100',
    });

    req.cookies = { access_token: validToken };
    authenticate(req, res, next);

    recordTest(
      'Auth Middleware',
      'Accepts valid HttpOnly access_token cookie and populates req.user',
      isNextCalled() &&
      req.user?.id === 'usr_cookie_88' &&
      req.user?.role === 'faculty',
    );
  }

  {
    const { req, res, next, getStatusCode, getResponseData } =
      createMockHttp();

    const expiredToken = jwt.sign(
      {
        sub: 'usr_cookie_expired',
        email: 'faculty@apex.edu',
        role: 'faculty',
        type: 'access',
      },
      jwtSecret,
      {
        algorithm: 'HS256',
        expiresIn: '-1s',
        issuer: config.JWT_ISSUER,
        audience: config.JWT_AUDIENCE,
      },
    );

    req.cookies = { access_token: expiredToken };
    authenticate(req, res, next);

    recordTest(
      'Auth Middleware',
      'Denies expired HttpOnly cookie with TOKEN_EXPIRED code (401)',
      getStatusCode() === 401 &&
      getErrorCode(getResponseData()) === 'TOKEN_EXPIRED',
    );
  }
}

/**
 * Suite 4: Role-Based Access Control and Tenant Isolation Tests.
 */
async function runRbacAndTenantTests(): Promise<void> {
  console.log('\n================================================================');
  console.log('  SUITE 4: Role Enforcement & Multi-Tenant Boundary Isolation');
  console.log('================================================================\n');

  {
    const { req, res, next, getStatusCode } = createMockHttp();

    requireRole('faculty')(req, res, next);

    recordTest(
      'RBAC',
      'Denies unauthenticated access before role check (401)',
      getStatusCode() === 401,
    );
  }

  {
    const { req, res, next, getStatusCode, getResponseData } =
      createMockHttp();

    req.user = {
      id: 'student_1',
      email: 'student@college.edu',
      role: 'student',
      institutionId: 'inst_1',
    };

    requireRole('faculty', 'college-admin')(req, res, next);

    recordTest(
      'RBAC',
      'Denies student accessing faculty/admin route (403 INSUFFICIENT_PERMISSIONS)',
      getStatusCode() === 403 &&
      getErrorCode(getResponseData()) === 'INSUFFICIENT_PERMISSIONS',
    );
  }

  {
    const { req, res, next, isNextCalled } = createMockHttp();

    req.user = {
      id: 'faculty_1',
      email: 'faculty@college.edu',
      role: 'faculty',
      institutionId: 'inst_1',
    };

    requireRole('faculty', 'college-admin')(req, res, next);

    recordTest(
      'RBAC',
      'Authorizes faculty accessing permitted route',
      isNextCalled(),
    );
  }

  {
    const { req, res, next, getStatusCode } = createMockHttp();

    req.user = {
      id: 'admin_sys',
      email: 'admin@platform.internal',
      role: 'platform-admin',
    };

    requireRole('student')(req, res, next);

    recordTest(
      'RBAC',
      'Restricts platform-admin from student-only workflow routes (403)',
      getStatusCode() === 403,
    );
  }

  {
    const { req, res, next, getStatusCode, getResponseData } =
      createMockHttp();

    req.user = {
      id: 'user_rogue',
      email: 'orphan@test.edu',
      role: 'faculty',
    };

    tenantResolver(req, res, next);

    recordTest(
      'Tenant Isolation',
      'Denies institutional user lacking institutionId (403 NO_INSTITUTIONAL_TENANCY)',
      getStatusCode() === 403 &&
      getErrorCode(getResponseData()) === 'NO_INSTITUTIONAL_TENANCY',
    );
  }

  {
    const { req, res, next, getStatusCode, getResponseData } =
      createMockHttp();

    req.user = {
      id: 'student_instA',
      email: 'student@institutionA.edu',
      role: 'student',
      institutionId: 'inst_AAA',
    };

    req.headers['x-institution-id'] = 'inst_BBB';

    tenantResolver(req, res, next);

    recordTest(
      'Tenant Isolation',
      'Blocks client attempting cross-tenant header tampering (403 CROSS_TENANT_ACCESS_DENIED)',
      getStatusCode() === 403 &&
      getErrorCode(getResponseData()) === 'CROSS_TENANT_ACCESS_DENIED',
    );
  }

  {
    const { req, res, next, isNextCalled } = createMockHttp();

    req.user = {
      id: 'student_instA',
      email: 'student@institutionA.edu',
      role: 'student',
      institutionId: 'inst_AAA',
    };

    tenantResolver(req, res, next);

    recordTest(
      'Tenant Isolation',
      'Strictly locks req.tenantId to user institutionId',
      isNextCalled() && req.tenantId === 'inst_AAA',
    );
  }

  {
    const { req, res, next, getStatusCode, getResponseData } =
      createMockHttp();

    req.user = {
      id: 'admin_instA',
      email: 'admin@institutionA.edu',
      role: 'college-admin',
      institutionId: 'inst_AAA',
    };

    req.params = { institutionId: 'inst_BBB' };

    requireTenantScope('params', 'institutionId')(req, res, next);

    recordTest(
      'Tenant Isolation',
      'Blocks user from accessing URL route parameterized with foreign tenant (403)',
      getStatusCode() === 403 &&
      getErrorCode(getResponseData()) === 'CROSS_TENANT_ACCESS_DENIED',
    );
  }

  {
    const { req, res, next, isNextCalled } = createMockHttp();

    req.user = {
      id: 'plat_root',
      email: 'root@platform.internal',
      role: 'platform-admin',
    };

    req.params = { institutionId: 'inst_ANY' };

    requireTenantScope('params', 'institutionId')(req, res, next);

    recordTest(
      'Tenant Isolation',
      'Permits Platform Admin cross-tenant inspection',
      isNextCalled(),
    );
  }
}

/**
 * Suite 5: Controller and Fail-Closed Behavior Tests.
 */
async function runControllerAndFailClosedTests(): Promise<void> {
  console.log('\n================================================================');
  console.log('  SUITE 5: Login Controller & Database Fail-Closed Verification');
  console.log('================================================================\n');

  {
    const { req, res, next, getStatusCode, getResponseData } =
      createMockHttp();

    req.body = { email: 'user@college.edu' };

    await login(req, res, next);

    recordTest(
      'Login Controller',
      'Rejects login without password (400 VALIDATION_FAILED)',
      getStatusCode() === 400 &&
      getErrorCode(getResponseData()) === 'VALIDATION_FAILED',
    );
  }

  {
    const dbConnected = isDatabaseConnected();

    if (!dbConnected) {
      const { req, res, next, getStatusCode, getResponseData } =
        createMockHttp();

      req.body = {
        email: 'student@apex.edu',
        password: 'Password123!',
      };

      await login(req, res, next);

      recordTest(
        'Fail Closed',
        'Fails closed with 503 DATABASE_UNAVAILABLE when database is disconnected',
        getStatusCode() === 503 &&
        getErrorCode(getResponseData()) === 'DATABASE_UNAVAILABLE',
      );
    } else {
      recordTest(
        'Fail Closed',
        'Database is currently connected (skipping offline probe)',
        true,
      );
    }
  }
}

async function main(): Promise<void> {
  console.log('================================================================');
  console.log('   PHASE 3B — AUTHENTICATION & MULTI-TENANT RBAC TEST SUITE     ');
  console.log('================================================================');

  try {
    await runPasswordSecurityTests();
    await runTokenSecurityTests();
    await runAuthMiddlewareTests();
    await runRbacAndTenantTests();
    await runControllerAndFailClosedTests();

    console.log('\n================================================================');
    console.log('                       TEST SUMMARY REPORT                      ');
    console.log('================================================================');

    const total = results.length;
    const passed = results.filter((result) => result.passed).length;
    const failed = total - passed;

    console.log(`Total Security & RBAC Checks : ${total}`);
    console.log(`Passed Checks                : ${passed}`);
    console.log(`Failed Checks                : ${failed}`);

    if (failed > 0) {
      console.error('\n[FAIL] One or more security verification tests failed.');
      process.exit(1);
    }

    console.log('\n[PASS] All security, authentication, and tenant isolation tests PASSED.');
  } catch (err: unknown) {
    console.error('\n[FATAL ERROR] Unexpected test runner failure:');

    if (err instanceof Error) {
      console.error(err.message);
      console.error(err.stack);
    } else {
      console.error(String(err));
    }

    process.exit(1);
  }
}

if (require.main === module) {
  void main();
}
