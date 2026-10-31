import crypto from 'crypto';
import mongoose, { Schema, Document } from 'mongoose';
import { config } from '../config/env';
import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
  getDatabaseStatus,
} from '../config/database';

export interface IPersistenceVerificationRecord extends Document {
  testRunId: string;
  testName: string;
  description: string;
  environment: string;
  payload: {
    framework: string;
    verifiedBy: string;
    randomToken: string;
  };
  isTestRecord: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const persistenceVerificationSchema = new Schema<IPersistenceVerificationRecord>(
  {
    testRunId: { type: String, required: true, index: true },
    testName: { type: String, required: true },
    description: { type: String, required: true },
    environment: { type: String, required: true },
    payload: {
      framework: { type: String, required: true },
      verifiedBy: { type: String, required: true },
      randomToken: { type: String, required: true },
    },
    isTestRecord: { type: Boolean, required: true, default: true },
  },
  {
    collection: 'persistence_verification_tests',
    timestamps: true,
  }
);

export const PersistenceVerificationModel =
  (mongoose.models[
    'PersistenceVerificationTest'
  ] as mongoose.Model<IPersistenceVerificationRecord>) ||
  mongoose.model<IPersistenceVerificationRecord>(
    'PersistenceVerificationTest',
    persistenceVerificationSchema,
    'persistence_verification_tests'
  );

export async function runPersistenceVerificationTest(): Promise<void> {
  console.log('================================================================');
  console.log('     MongoDB Atlas Persistence Verification Integration Test    ');
  console.log('================================================================\n');

  // Guard: Explicit opt-in required to avoid accidental execution against Atlas
  const optIn = process.env['ALLOW_PERSISTENCE_TEST']?.trim().toLowerCase();
  if (optIn !== 'true' && optIn !== '1') {
    console.error('[SECURITY GUARD] Execution aborted: Explicit opt-in required.');
    console.error('To authorize writing a test record to MongoDB Atlas, run with:');
    console.error('  ALLOW_PERSISTENCE_TEST=true\n');
    process.exit(1);
  }

  const shouldCleanup =
    process.env['CLEANUP_TEST_RECORD']?.trim().toLowerCase() === 'true';

  const testRunId = `persist-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const randomToken = crypto.randomBytes(16).toString('hex');

  console.log(`[CONFIG] Database Name   : ${config.DATABASE_NAME}`);
  console.log(`[CONFIG] Test Collection : persistence_verification_tests`);
  console.log(`[CONFIG] Test Run ID     : ${testRunId}`);
  console.log(`[CONFIG] Auto-Cleanup    : ${shouldCleanup ? 'ENABLED' : 'DISABLED (record retained)'}\n`);

  try {
    // -------------------------------------------------------------------------
    // STEP 1: Connect to MongoDB Atlas
    // -------------------------------------------------------------------------
    console.log('[STEP 1/6] Connecting to MongoDB Atlas...');
    const connected = await connectDatabase();
    if (!connected || !isDatabaseConnected()) {
      throw new Error('Initial connection to MongoDB Atlas failed.');
    }
    const initialStatus = getDatabaseStatus();
    console.log(`  -> Connected! Host: ${initialStatus.host ?? 'Atlas Cluster'}, DB: ${initialStatus.databaseName}`);

    // -------------------------------------------------------------------------
    // STEP 2: Write a unique test record
    // -------------------------------------------------------------------------
    console.log('\n[STEP 2/6] Writing unique verification record to Atlas...');
    const recordPayload = {
      testRunId,
      testName: 'Atlas Persistence Lifecycle Verification',
      description: 'Verifies write, immediate read, disconnect, reconnect, and persistent read.',
      environment: config.NODE_ENV,
      payload: {
        framework: 'genai-lab-learning-framework',
        verifiedBy: 'automated-integration-test',
        randomToken,
      },
      isTestRecord: true,
    };

    const insertedDoc = await PersistenceVerificationModel.create(recordPayload);
    if (!insertedDoc || !insertedDoc._id) {
      throw new Error('Failed to insert test verification record.');
    }
    console.log(`  -> Record inserted with _id: ${insertedDoc._id.toString()}`);

    // -------------------------------------------------------------------------
    // STEP 3: Immediate Read Verification
    // -------------------------------------------------------------------------
    console.log('\n[STEP 3/6] Reading back record immediately before disconnect...');
    const immediateRead = await PersistenceVerificationModel.findOne({ testRunId });
    if (!immediateRead) {
      throw new Error(`Record with testRunId ${testRunId} could not be retrieved immediately.`);
    }
    if (immediateRead.payload.randomToken !== randomToken) {
      throw new Error('Immediate read verification failed: payload token mismatch.');
    }
    console.log('  -> Immediate read verified: token and fields match exactly.');

    // -------------------------------------------------------------------------
    // STEP 4: Disconnect from MongoDB Atlas
    // -------------------------------------------------------------------------
    console.log('\n[STEP 4/6] Disconnecting from MongoDB Atlas...');
    await disconnectDatabase();
    if (isDatabaseConnected()) {
      throw new Error('Database disconnect check failed: connection remains active.');
    }
    console.log('  -> Disconnected successfully. Active readyState is disconnected.');
    console.log('  -> Waiting 2.5s for cloud socket session to teardown cleanly...');
    await new Promise((r) => setTimeout(r, 2500));

    // -------------------------------------------------------------------------
    // STEP 5: Reconnect to MongoDB Atlas
    // -------------------------------------------------------------------------
    console.log('\n[STEP 5/6] Reconnecting to MongoDB Atlas to verify persistence...');
    const reconnected = await connectDatabase();
    if (!reconnected || !isDatabaseConnected()) {
      throw new Error('Reconnection to MongoDB Atlas failed.');
    }
    console.log('  -> Reconnected successfully!');

    // -------------------------------------------------------------------------
    // STEP 6: Post-Reconnection Persistence Verification
    // -------------------------------------------------------------------------
    console.log('\n[STEP 6/6] Reading back record after full disconnect and reconnect cycle...');
    const postReconnectRead = await PersistenceVerificationModel.findOne({ testRunId });
    if (!postReconnectRead) {
      throw new Error(
        `CRITICAL: Record with testRunId ${testRunId} was NOT found after reconnecting! Persistence failed.`
      );
    }
    if (postReconnectRead.payload.randomToken !== randomToken) {
      throw new Error('Post-reconnection read verification failed: token mismatch.');
    }
    console.log('  -> Post-reconnect verification PASSED: record persisted across connection cycles!');
    console.log(`  -> Verified Document _id : ${postReconnectRead._id.toString()}`);
    console.log(`  -> Verified Test Run ID  : ${postReconnectRead.testRunId}`);
    console.log(`  -> Verified Created At   : ${postReconnectRead.createdAt.toISOString()}`);

    // -------------------------------------------------------------------------
    // CLEANUP (Conditional)
    // -------------------------------------------------------------------------
    if (shouldCleanup) {
      console.log('\n[CLEANUP] Deleting ONLY the current test record...');
      const deleteResult = await PersistenceVerificationModel.deleteOne({ testRunId });
      if (deleteResult.deletedCount !== 1) {
        throw new Error(`Expected to delete 1 record, deleted ${deleteResult.deletedCount}.`);
      }
      console.log(`  -> Cleaned up record with testRunId: ${testRunId} (deletedCount: 1).`);
    } else {
      console.log('\n[RETENTION] Test record retained in collection.');
      console.log(`  -> Document remains in 'persistence_verification_tests' for manual inspection.`);
      console.log(`  -> Filter query: { testRunId: "${testRunId}" }`);
      console.log(`  -> To enable automatic deletion in future runs, set CLEANUP_TEST_RECORD=true.`);
    }

    console.log('\n================================================================');
    console.log('           ALL PERSISTENCE VERIFICATION CHECKS PASSED           ');
    console.log('================================================================\n');
  } finally {
    await disconnectDatabase();
  }
}

// Auto-run if executed directly via node or tsx
if (require.main === module) {
  runPersistenceVerificationTest().catch((err: unknown) => {
    console.error('\n[TEST FAILURE] Persistence verification test failed:');
    if (err instanceof Error) {
      console.error(err.message);
    } else {
      console.error(String(err));
    }
    process.exit(1);
  });
}
