import crypto from 'crypto';
import jwt, { SignOptions, VerifyOptions } from 'jsonwebtoken';
import { config } from '../config/env';
import { UserRole } from '../models/User';

export interface IAccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
  institutionId?: string;
  type: 'access';
}

export interface IRefreshTokenPayload {
  sub: string;
  tokenId: string;
  type: 'refresh';
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  expiresIn: string;
}

const JWT_ALGORITHM = 'HS256';

function requireSecret(secret: string | undefined, name: string): string {
  if (typeof secret !== 'string' || secret.length === 0) {
    throw new Error(`${name} is not configured`);
  }
  return secret;
}

const ACCESS_SECRET = () => requireSecret(config.JWT_SECRET, 'JWT_SECRET');
const REFRESH_SECRET = () =>
  requireSecret(config.JWT_REFRESH_SECRET, 'JWT_REFRESH_SECRET');

const validRoles: UserRole[] = [
  'platform-admin',
  'college-admin',
  'faculty',
  'student',
];

export function signAccessToken(
  payload: Omit<IAccessTokenPayload, 'type'>
): string {
  const options: SignOptions = {
    algorithm: JWT_ALGORITHM,
    expiresIn: config.JWT_ACCESS_EXPIRY as SignOptions['expiresIn'],
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  };

  return jwt.sign({ ...payload, type: 'access' }, ACCESS_SECRET(), options);
}

export function signRefreshToken(
  userId: string
): { refreshToken: string; tokenId: string } {
  const tokenId = crypto.randomUUID();

  const options: SignOptions = {
    algorithm: JWT_ALGORITHM,
    expiresIn: config.JWT_REFRESH_EXPIRY as SignOptions['expiresIn'],
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  };

  const refreshToken = jwt.sign(
    { sub: userId, tokenId, type: 'refresh' },
    REFRESH_SECRET(),
    options
  );

  return { refreshToken, tokenId };
}

export function generateAuthTokens(user: {
  _id: string | { toString(): string };
  email: string;
  role: UserRole;
  institutionId?: string | { toString(): string };
}): { tokens: IAuthTokens; tokenId: string } {
  const userId = user._id.toString();
  const institutionId = user.institutionId?.toString();

  const accessToken = signAccessToken({
    sub: userId,
    email: user.email,
    role: user.role,
    institutionId,
  });

  const { refreshToken, tokenId } = signRefreshToken(userId);

  return {
    tokens: {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: config.JWT_ACCESS_EXPIRY as string,
    },
    tokenId,
  };
}

export function verifyAccessToken(token: string): IAccessTokenPayload {
  const options: VerifyOptions = {
    algorithms: [JWT_ALGORITHM],
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  };

  const decoded = jwt.verify(token, ACCESS_SECRET(), options);

  if (
    typeof decoded === 'string' ||
    !decoded ||
    typeof decoded !== 'object'
  ) {
    throw new Error('Invalid access token payload');
  }

  const payload = decoded as unknown as IAccessTokenPayload;

  if (
    payload.type !== 'access' ||
    typeof payload.sub !== 'string' ||
    typeof payload.email !== 'string' ||
    !validRoles.includes(payload.role)
  ) {
    throw new Error('Invalid access token claims');
  }

  return payload;
}

export function verifyRefreshToken(token: string): IRefreshTokenPayload {
  const options: VerifyOptions = {
    algorithms: [JWT_ALGORITHM],
    issuer: config.JWT_ISSUER,
    audience: config.JWT_AUDIENCE,
  };

  const decoded = jwt.verify(token, REFRESH_SECRET(), options);

  if (
    typeof decoded === 'string' ||
    !decoded ||
    typeof decoded !== 'object'
  ) {
    throw new Error('Invalid refresh token payload');
  }

  const payload = decoded as unknown as IRefreshTokenPayload;

  if (
    payload.type !== 'refresh' ||
    typeof payload.sub !== 'string' ||
    typeof payload.tokenId !== 'string'
  ) {
    throw new Error('Invalid refresh token claims');
  }

  return payload;
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}