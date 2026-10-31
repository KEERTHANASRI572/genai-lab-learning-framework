import { User } from '../models/User';
import { hashPassword, validatePasswordStrength } from '../utils/password';
import { connectDatabase, disconnectDatabase, isDatabaseConnected } from '../config/database';

/**
 * Platform Administrator Provisioning CLI Script:
 *
 * Usage:
 *   PLATFORM_ADMIN_NAME="Alice Admin" \
 *   PLATFORM_ADMIN_EMAIL="alice@platform.internal" \
 *   PLATFORM_ADMIN_PASSWORD="StrongPassword123!" \
 *   npm run seed:admin
 *
 * Security Rules:
 * - Never uses default, hardcoded, or demo passwords.
 * - Enforces strong password complexity validation.
 * - Refuses to overwrite existing accounts without explicit confirmation.
 * - Masks credentials from all logs.
 */
export async function seedPlatformAdmin(): Promise<void> {
  console.log('================================================================');
  console.log('     Platform Administrator Provisioning Utility (Phase 3B)     ');
  console.log('================================================================\n');

  const name = process.env['PLATFORM_ADMIN_NAME']?.trim();
  const email = process.env['PLATFORM_ADMIN_EMAIL']?.trim().toLowerCase();
  const password = process.env['PLATFORM_ADMIN_PASSWORD'];

  if (!name || !email || !password) {
    console.error('[ERROR] Missing required provisioning credentials.');
    console.error('The following environment variables must be provided by the authorized operator:');
    console.error('  PLATFORM_ADMIN_NAME     : Full name of the platform administrator');
    console.error('  PLATFORM_ADMIN_EMAIL    : Email address');
    console.error('  PLATFORM_ADMIN_PASSWORD : Secure password (min 8 chars, uppercase, lowercase, number, symbol)\n');
    console.error('Example:');
    console.error('  PLATFORM_ADMIN_NAME="System Operator" PLATFORM_ADMIN_EMAIL="admin@platform.internal" PLATFORM_ADMIN_PASSWORD="SecurePass123!" npm run seed:admin\n');
    process.exit(1);
  }

  // Validate password strength
  const validation = validatePasswordStrength(password);
  if (!validation.valid) {
    console.error(`[SECURITY ERROR] Password does not satisfy security policy: ${validation.message}`);
    process.exit(1);
  }

  // Connect to database
  console.log('[STEP 1/3] Connecting to database...');
  const connected = await connectDatabase();
  if (!connected || !isDatabaseConnected()) {
    console.error('[ERROR] Cannot connect to database. Ensure MongoDB is accessible.');
    process.exit(1);
  }

  try {
    // Check if user already exists
    console.log(`[STEP 2/3] Checking if account '${email}' already exists...`);
    const existing = await User.findOne({ email });
    if (existing) {
      console.warn(`[WARNING] An account with email '${email}' already exists (role: ${existing.role}).`);
      console.warn('Provisioning aborted. Will not overwrite existing account without explicit intervention.');
      process.exit(0);
    }

    // Hash password
    console.log('[STEP 3/3] Hashing password and creating platform administrator...');
    const passwordHash = await hashPassword(password);

    const admin = await User.create({
      name,
      email,
      passwordHash,
      role: 'platform-admin',
      status: 'active',
      profile: {
        designation: 'Platform Administrator',
      },
    });

    console.log('\n[SUCCESS] Platform Administrator provisioned successfully!');
    console.log(`  User ID : ${admin._id.toString()}`);
    console.log(`  Name    : ${admin.name}`);
    console.log(`  Email   : ${admin.email}`);
    console.log(`  Role    : ${admin.role}`);
    console.log(`  Status  : ${admin.status}`);
    console.log('\nOperator can now log in via POST /api/v1/auth/login using these credentials.');
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  seedPlatformAdmin().catch((err: unknown) => {
    console.error('\n[FATAL ERROR] Platform admin provisioning failed:');
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(String(err));
    }
    process.exit(1);
  });
}
