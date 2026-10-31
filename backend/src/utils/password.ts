import bcrypt from 'bcryptjs';

const BCRYPT_SALT_ROUNDS = 12;

export interface PasswordValidationResult {
  valid: boolean;
  message?: string;
}

/**
 * Validates password strength rules:
 * - Minimum 8 characters, maximum 128 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special symbol
 */
export function validatePasswordStrength(password: string): PasswordValidationResult {
  if (!password || typeof password !== 'string') {
    return { valid: false, message: 'Password is required' };
  }

  if (password.length < 8) {
    return { valid: false, message: 'Password must be at least 8 characters in length' };
  }

  if (password.length > 128) {
    return { valid: false, message: 'Password cannot exceed 128 characters' };
  }

  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?`~]/.test(password);

  if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
    return {
      valid: false,
      message:
        'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
    };
  }

  return { valid: true };
}

/**
 * Hashes a plaintext password using bcrypt with salt rounds = 12.
 */
export async function hashPassword(plaintext: string): Promise<string> {
  const validation = validatePasswordStrength(plaintext);
  if (!validation.valid) {
    throw new Error(validation.message || 'Password does not meet complexity requirements');
  }

  return bcrypt.hash(plaintext, BCRYPT_SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash.
 * Returns boolean without ever exposing the hash or leaking details.
 */
export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  if (!plaintext || !hash) {
    return false;
  }

  try {
    return await bcrypt.compare(plaintext, hash);
  } catch {
    return false;
  }
}
