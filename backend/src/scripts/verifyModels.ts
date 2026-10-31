import crypto from 'crypto';
import mongoose from 'mongoose';
import { config } from '../config/env';
import {
  connectDatabase,
  disconnectDatabase,
  isDatabaseConnected,
  getDatabaseStatus,
} from '../config/database';
import {
  Institution,
  Department,
  Course,
  Subject,
  Laboratory,
  Experiment,
  User,
  LearningResource,
  LearnerProfile,
  Assessment,
  AssessmentAttempt,
  LearningSession,
  HelpRequest,
  AuditLog,
} from '../models';

interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function recordTest(suite: string, testName: string, passed: boolean, message?: string) {
  results.push({ suite, testName, passed, message });
  const statusSymbol = passed ? '✓' : '✗';
  console.log(`  [${statusSymbol}] ${testName}${message ? ` (${message})` : ''}`);
  if (!passed) {
    console.error(`      ERROR: ${message}`);
  }
}

/**
 * Validates a Mongoose document asynchronously using the modern validate() API,
 * capturing and returning any ValidationError.
 */
async function getValidationError(
  doc: mongoose.Document
): Promise<mongoose.Error.ValidationError | null> {
  try {
    await doc.validate();
    return null;
  } catch (err) {
    if (err instanceof mongoose.Error.ValidationError) {
      return err;
    }
    throw err;
  }
}

/**
 * Suite 1: Pure Schema & Model Validation Unit Tests
 * These verify validation rules, constraints, defaults, and regex patterns in memory.
 */
async function runSchemaValidationTests(): Promise<void> {
  console.log('\n================================================================');
  console.log('  SUITE 1: Schema-Level Validation & Integrity Checks (In-Memory)');
  console.log('================================================================\n');

  // 1. Institution Model
  {
    const missingName = new Institution({
      code: 'TEST-INST',
      domain: 'test.edu',
      adminEmail: 'admin@test.edu',
    });
    const err = await getValidationError(missingName);
    recordTest(
      'Institution',
      'Requires institution name',
      !!err?.errors['name'],
      err?.errors['name']?.message
    );

    const invalidDomain = new Institution({
      name: 'Test College',
      code: 'TEST',
      domain: 'invalid_domain_format',
      adminEmail: 'admin@test.edu',
    });
    const domainErr = await getValidationError(invalidDomain);
    recordTest(
      'Institution',
      'Rejects invalid domain format',
      !!domainErr?.errors['domain'],
      domainErr?.errors['domain']?.message
    );

    const validInst = new Institution({
      name: 'Valid Engineering College',
      code: 'VEC',
      domain: 'vec.edu.in',
      adminEmail: 'provost@vec.edu.in',
      type: 'engineering_college',
    });
    const validErr = await getValidationError(validInst);
    recordTest('Institution', 'Accepts valid institution payload', !validErr);
  }

  // 2. Department Model
  {
    const missingTenant = new Department({
      name: 'Computer Science',
      code: 'CSE',
    });
    const err = await getValidationError(missingTenant);
    recordTest(
      'Department',
      'Requires institutional tenancy (institutionId)',
      !!err?.errors['institutionId']
    );

    const validDept = new Department({
      institutionId: new mongoose.Types.ObjectId(),
      name: 'Computer Science and Engineering',
      code: 'CSE',
      status: 'active',
    });
    recordTest('Department', 'Accepts valid department schema', !(await getValidationError(validDept)));
  }

  // 3. Course Model
  {
    const invalidSemesters = new Course({
      institutionId: new mongoose.Types.ObjectId(),
      departmentId: new mongoose.Types.ObjectId(),
      name: 'Bachelor of Technology',
      code: 'BTECH',
      totalSemesters: 15, // Max is 12
    });
    const err = await getValidationError(invalidSemesters);
    recordTest(
      'Course',
      'Enforces totalSemesters max limit (<= 12)',
      !!err?.errors['totalSemesters']
    );
  }

  // 4. Subject Model
  {
    const missingCode = new Subject({
      institutionId: new mongoose.Types.ObjectId(),
      departmentId: new mongoose.Types.ObjectId(),
      courseId: new mongoose.Types.ObjectId(),
      name: 'Algorithms',
      semester: 3,
    });
    const err = await getValidationError(missingCode);
    recordTest('Subject', 'Requires subject code', !!err?.errors['code']);
  }

  // 5. Laboratory Model
  {
    const validLab = new Laboratory({
      institutionId: new mongoose.Types.ObjectId(),
      departmentId: new mongoose.Types.ObjectId(),
      courseId: new mongoose.Types.ObjectId(),
      subjectId: new mongoose.Types.ObjectId(),
      name: 'Advanced Computing Lab',
      code: 'CS301L',
      capacity: 30,
    });
    recordTest('Laboratory', 'Accepts valid laboratory hierarchy', !(await getValidationError(validLab)));
  }

  // 6. Experiment Model
  {
    const expWithSteps = new Experiment({
      institutionId: new mongoose.Types.ObjectId(),
      departmentId: new mongoose.Types.ObjectId(),
      courseId: new mongoose.Types.ObjectId(),
      subjectId: new mongoose.Types.ObjectId(),
      laboratoryId: new mongoose.Types.ObjectId(),
      authorFacultyUserId: new mongoose.Types.ObjectId(),
      title: 'AVL Tree Balancing',
      code: 'EXP-01',
    });
    const validErr = await getValidationError(expWithSteps);
    recordTest(
      'Experiment',
      'Accepts experiment with default step array',
      !validErr,
      validErr ? JSON.stringify(validErr.errors) : undefined
    );
  }

  // 7. User Model
  {
    const invalidEmail = new User({
      name: 'John Doe',
      email: 'not-an-email',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'student',
      institutionId: new mongoose.Types.ObjectId(),
    });
    const emailErr = await getValidationError(invalidEmail);
    recordTest('User', 'Rejects invalid user email address', !!emailErr?.errors['email']);

    const studentMissingTenant = new User({
      name: 'Jane Student',
      email: 'jane@college.edu',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'student',
    });
    const tenantErr = await getValidationError(studentMissingTenant);
    recordTest(
      'User',
      'Enforces institutionId requirement for student role',
      !!tenantErr?.errors['institutionId']
    );

    const platformAdminNoTenant = new User({
      name: 'System Root',
      email: 'root@platform.internal',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456',
      role: 'platform-admin',
    });
    const adminErr = await getValidationError(platformAdminNoTenant);
    recordTest(
      'User',
      'Permits platform-admin to exist without institutionId',
      !adminErr?.errors['institutionId']
    );
  }

  // 8. LearningResource Model
  {
    const missingStorageKey = new LearningResource({
      institutionId: new mongoose.Types.ObjectId(),
      title: 'Lab Manual',
      category: 'manual',
      format: 'PDF',
      mimeType: 'application/pdf',
      fileSizeBytes: 1024,
      uploadedByUserId: new mongoose.Types.ObjectId(),
    });
    const err = await getValidationError(missingStorageKey);
    recordTest(
      'LearningResource',
      'Requires storageKey reference (metadata only, no file bloat)',
      !!err?.errors['storageKey']
    );
  }

  // 9. LearnerProfile Model (Evidence-Driven Topic Proficiencies)
  {
    const invalidConfidence = new LearnerProfile({
      studentId: new mongoose.Types.ObjectId(),
      institutionId: new mongoose.Types.ObjectId(),
      topicProficiencies: [
        {
          topicTag: 'binary_trees',
          currentLevel: 'intermediate',
          confidenceScore: 1.5, // Exceeds 1.0
          evidenceSource: 'initial_diagnostic',
          assessedAt: new Date(),
        },
      ],
    });
    const err = await getValidationError(invalidConfidence);
    recordTest(
      'LearnerProfile',
      'Enforces confidenceScore bounds [0.0 - 1.0]',
      !!err?.errors['topicProficiencies.0.confidenceScore']
    );

    const validProfile = new LearnerProfile({
      studentId: new mongoose.Types.ObjectId(),
      institutionId: new mongoose.Types.ObjectId(),
      topicProficiencies: [
        {
          topicTag: 'binary_trees',
          currentLevel: 'intermediate',
          confidenceScore: 0.85,
          evidenceSource: 'initial_diagnostic',
          assessedAt: new Date(),
        },
      ],
    });
    recordTest(
      'LearnerProfile',
      'Accepts evidence-driven topic proficiency entry',
      !(await getValidationError(validProfile))
    );
  }

  // 10. Assessment Model
  {
    const singleOption = new Assessment({
      institutionId: new mongoose.Types.ObjectId(),
      experimentId: new mongoose.Types.ObjectId(),
      type: 'initial_diagnostic',
      title: 'Pre-Lab Quiz',
      authorFacultyUserId: new mongoose.Types.ObjectId(),
      questions: [
        {
          questionId: 'Q1',
          topicTag: 'trees',
          prompt: 'What is a tree?',
          options: [{ optionId: 'A', text: 'A data structure' }], // Only 1 option
          correctOptionId: 'A',
          difficulty: 'beginner',
          weight: 1,
        },
      ],
    });
    const err = await getValidationError(singleOption);
    recordTest(
      'Assessment',
      'Rejects questions with fewer than 2 selectable options',
      !!err?.errors['questions.0.options']
    );
  }

  // 11. AssessmentAttempt Model
  {
    const invalidScore = new AssessmentAttempt({
      institutionId: new mongoose.Types.ObjectId(),
      assessmentId: new mongoose.Types.ObjectId(),
      experimentId: new mongoose.Types.ObjectId(),
      studentId: new mongoose.Types.ObjectId(),
      attemptNumber: 1,
      type: 'initial_diagnostic',
      scorePercent: 110, // Exceeds 100
      passed: true,
    });
    const err = await getValidationError(invalidScore);
    recordTest(
      'AssessmentAttempt',
      'Enforces scorePercent max limit (<= 100)',
      !!err?.errors['scorePercent']
    );
  }

  // 12. LearningSession Model
  {
    const validSession = new LearningSession({
      institutionId: new mongoose.Types.ObjectId(),
      studentId: new mongoose.Types.ObjectId(),
      experimentId: new mongoose.Types.ObjectId(),
      assignedScaffoldingLevel: 'intermediate',
      currentStepNumber: 1,
      sessionStatus: 'in_progress',
    });
    recordTest('LearningSession', 'Initializes persistent lab session', !(await getValidationError(validSession)));
  }

  // 13. HelpRequest Model
  {
    const shortQuery = new HelpRequest({
      institutionId: new mongoose.Types.ObjectId(),
      studentId: new mongoose.Types.ObjectId(),
      studentName: 'Alex',
      experimentId: new mongoose.Types.ObjectId(),
      experimentTitle: 'Lab 1',
      stepNumber: 1,
      studentQuery: 'help', // Too short (< 5 chars)
      escalationReason: 'student_requested',
    });
    const err = await getValidationError(shortQuery);
    recordTest(
      'HelpRequest',
      'Enforces studentQuery minlength >= 5 characters',
      !!err?.errors['studentQuery']
    );
  }

  // 14. AuditLog Model (Sanitization of sensitive fields)
  {
    const auditWithSecret = new AuditLog({
      actorEmail: 'admin@college.edu',
      actorRole: 'college-admin',
      action: 'user.create',
      targetDomain: 'auth',
      ipAddress: '192.168.1.1',
      status: 'success',
      details: {
        targetUser: 'student@college.edu',
        password: 'RawPassword123!',
        authToken: 'Bearer eyJhbGciOi...',
        secretKey: 'top_secret',
      },
    });

    // Details setter triggers automatic sanitization
    const sanitized = auditWithSecret.details as Record<string, unknown>;
    const passwordSanitized = sanitized['password'] === '[REDACTED_BY_SECURITY_POLICY]';
    const tokenSanitized = sanitized['authToken'] === '[REDACTED_BY_SECURITY_POLICY]';
    const secretSanitized = sanitized['secretKey'] === '[REDACTED_BY_SECURITY_POLICY]';
    const cleanUserRetained = sanitized['targetUser'] === 'student@college.edu';

    recordTest(
      'AuditLog',
      'Automatically redacts sensitive keys (passwords, tokens, secrets) from audit details',
      passwordSanitized && tokenSanitized && secretSanitized && cleanUserRetained
    );
  }
}

/**
 * Suite 2: Compound Unique Index & Schema Index Registry Verification
 */
function runIndexVerificationTests(): void {
  console.log('\n================================================================');
  console.log('  SUITE 2: Schema Index Registry & Compound Uniqueness Checks');
  console.log('================================================================\n');

  const checkIndex = (model: mongoose.Model<any>, expectedKeys: Record<string, number>, isUnique: boolean) => {
    const indexes = model.schema.indexes();
    const match = indexes.find(([fields, options]) => {
      const keys = Object.keys(fields);
      const expectedKeyNames = Object.keys(expectedKeys);
      if (keys.length !== expectedKeyNames.length) return false;
      const allMatch = expectedKeyNames.every(
        (k) => (fields as Record<string, number>)[k] === expectedKeys[k]
      );
      if (!allMatch) return false;
      if (isUnique) return options?.unique === true;
      return true;
    });
    return !!match;
  };

  recordTest(
    'Department Indexes',
    'Has compound unique index on { institutionId: 1, code: 1 }',
    checkIndex(Department, { institutionId: 1, code: 1 }, true)
  );

  recordTest(
    'Course Indexes',
    'Has compound unique index on { institutionId: 1, departmentId: 1, code: 1 }',
    checkIndex(Course, { institutionId: 1, departmentId: 1, code: 1 }, true)
  );

  recordTest(
    'Subject Indexes',
    'Has compound unique index on { institutionId: 1, courseId: 1, code: 1 }',
    checkIndex(Subject, { institutionId: 1, courseId: 1, code: 1 }, true)
  );

  recordTest(
    'Laboratory Indexes',
    'Has compound unique index on { institutionId: 1, courseId: 1, code: 1 }',
    checkIndex(Laboratory, { institutionId: 1, courseId: 1, code: 1 }, true)
  );

  recordTest(
    'Experiment Indexes',
    'Has compound unique index on { institutionId: 1, laboratoryId: 1, code: 1 }',
    checkIndex(Experiment, { institutionId: 1, laboratoryId: 1, code: 1 }, true)
  );

  recordTest(
    'User Indexes',
    'Has compound unique index on { institutionId: 1, email: 1 }',
    checkIndex(User, { institutionId: 1, email: 1 }, true)
  );

  recordTest(
    'LearnerProfile Indexes',
    'Has compound unique index on { institutionId: 1, studentId: 1 }',
    checkIndex(LearnerProfile, { institutionId: 1, studentId: 1 }, true)
  );

  recordTest(
    'Assessment Indexes',
    'Has compound unique index on { experimentId: 1, type: 1 }',
    checkIndex(Assessment, { experimentId: 1, type: 1 }, true)
  );

  recordTest(
    'AssessmentAttempt Indexes',
    'Has compound unique index on { institutionId: 1, studentId: 1, experimentId: 1, attemptNumber: 1 }',
    checkIndex(AssessmentAttempt, { institutionId: 1, studentId: 1, experimentId: 1, attemptNumber: 1 }, true)
  );
}

/**
 * Suite 3: Non-Destructive Live Atlas Integration Verification
 * Attempt live verification if connectivity is available.
 */
async function runLiveAtlasIntegrationTests(): Promise<void> {
  console.log('\n================================================================');
  console.log('  SUITE 3: Non-Destructive MongoDB Atlas Relational Integration');
  console.log('================================================================\n');

  if (!config.MONGODB_URI) {
    console.log('  [i] MONGODB_URI not configured. Skipping live Atlas integration suite.');
    return;
  }

  console.log('  [i] Testing live database connection to Atlas...');
  const connected = await connectDatabase(1, 1000); // 1 fast attempt to check availability
  if (!connected || !isDatabaseConnected()) {
    console.log('  [NOTICE] MongoDB Atlas is currently unreachable due to network error/IP whitelist.');
    console.log('  [NOTICE] Preserving existing schema verification. Skipping live database operations.');
    return;
  }

  const dbStatus = getDatabaseStatus();
  console.log(`  -> Connected to Atlas: ${dbStatus.databaseName} (${dbStatus.host})`);

  const testSuffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  const testInstitutionCode = `TST-${testSuffix.slice(0, 8).toUpperCase()}`;

  const createdIds: {
    Institution: mongoose.Types.ObjectId[];
    Department: mongoose.Types.ObjectId[];
    Course: mongoose.Types.ObjectId[];
    Subject: mongoose.Types.ObjectId[];
    Laboratory: mongoose.Types.ObjectId[];
    Experiment: mongoose.Types.ObjectId[];
    User: mongoose.Types.ObjectId[];
    LearnerProfile: mongoose.Types.ObjectId[];
    AuditLog: mongoose.Types.ObjectId[];
  } = {
    Institution: [],
    Department: [],
    Course: [],
    Subject: [],
    Laboratory: [],
    Experiment: [],
    User: [],
    LearnerProfile: [],
    AuditLog: [],
  };

  try {
    // 1. Create Test Institution
    const testInst = await Institution.create({
      name: `Test University ${testSuffix}`,
      code: testInstitutionCode,
      domain: `test-${testSuffix}.edu`,
      adminEmail: `admin@test-${testSuffix}.edu`,
      type: 'university',
      status: 'active',
    });
    createdIds['Institution'].push(testInst._id);
    recordTest('Live Integration', 'Persists Institution to Atlas', !!testInst._id);

    // 2. Create Test Department
    const testDept = await Department.create({
      institutionId: testInst._id,
      name: 'Department of Computing',
      code: 'DOC',
      status: 'active',
    });
    createdIds['Department'].push(testDept._id);
    recordTest('Live Integration', 'Persists Department linked to Institution', !!testDept._id);

    // 3. Create Test Course
    const testCourse = await Course.create({
      institutionId: testInst._id,
      departmentId: testDept._id,
      name: 'B.Tech in Artificial Intelligence',
      code: 'BTECH-AI',
      degreeLevel: 'undergraduate',
      totalSemesters: 8,
    });
    createdIds['Course'].push(testCourse._id);
    recordTest('Live Integration', 'Persists Course linked to Department', !!testCourse._id);

    // 4. Create Test Subject
    const testSubject = await Subject.create({
      institutionId: testInst._id,
      departmentId: testDept._id,
      courseId: testCourse._id,
      name: 'Intelligent Systems Lab Course',
      code: 'AI301',
      semester: 3,
      credits: 4,
    });
    createdIds['Subject'].push(testSubject._id);
    recordTest('Live Integration', 'Persists Subject linked to Course', !!testSubject._id);

    // 5. Create Test Laboratory
    const testLab = await Laboratory.create({
      institutionId: testInst._id,
      departmentId: testDept._id,
      courseId: testCourse._id,
      subjectId: testSubject._id,
      name: 'Autonomous Systems & AI Lab',
      code: 'AI301L',
      capacity: 30,
    });
    createdIds['Laboratory'].push(testLab._id);
    recordTest('Live Integration', 'Persists Laboratory linked to Subject', !!testLab._id);

    // 6. Create Test Faculty User
    const testFaculty = await User.create({
      name: 'Dr. Test Professor',
      email: `prof-${testSuffix}@test.edu`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456789012345678',
      role: 'faculty',
      institutionId: testInst._id,
      departmentId: testDept._id,
    });
    createdIds['User'].push(testFaculty._id);
    recordTest('Live Integration', 'Persists Faculty User with secured passwordHash', !!testFaculty._id);

    // Verify passwordHash is not returned in default queries
    const fetchedUser = await User.findById(testFaculty._id);
    recordTest(
      'Live Integration',
      'Protects passwordHash from default query projection',
      fetchedUser?.passwordHash === undefined
    );

    // 7. Create Test Experiment
    const testExp = await Experiment.create({
      institutionId: testInst._id,
      departmentId: testDept._id,
      courseId: testCourse._id,
      subjectId: testSubject._id,
      laboratoryId: testLab._id,
      authorFacultyUserId: testFaculty._id,
      title: 'Neural Network Forward Propagation',
      code: 'EXP-NN-01',
      procedureSteps: [
        {
          stepNumber: 1,
          title: 'Weight Initialization',
          instruction: 'Initialize weight matrix using He initialization.',
          expectedObservation: 'Weights follow gaussian distribution.',
          requiredApparatus: ['Python Environment'],
          verificationType: 'code_execution',
        },
      ],
      estimatedDurationMins: 60,
      topicTags: ['neural_networks', 'ai'],
      status: 'published',
    });
    createdIds['Experiment'].push(testExp._id);
    recordTest('Live Integration', 'Persists Experiment with procedure step subdocuments', !!testExp._id);

    // 8. Create Test Student User
    const testStudent = await User.create({
      name: 'Student Learner',
      email: `student-${testSuffix}@test.edu`,
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz123456789012345678',
      role: 'student',
      institutionId: testInst._id,
      departmentId: testDept._id,
    });
    createdIds['User'].push(testStudent._id);

    // 9. Create Test LearnerProfile
    const testProfile = await LearnerProfile.create({
      studentId: testStudent._id,
      institutionId: testInst._id,
      departmentId: testDept._id,
      topicProficiencies: [
        {
          topicTag: 'neural_networks',
          experimentId: testExp._id,
          currentLevel: 'intermediate',
          confidenceScore: 0.88,
          evidenceSource: 'initial_diagnostic',
          assessedAt: new Date(),
        },
      ],
    });
    createdIds['LearnerProfile'].push(testProfile._id);
    recordTest(
      'Live Integration',
      'Persists LearnerProfile with evidence-driven topic proficiencies',
      !!testProfile._id
    );

    // 10. Create Test AuditLog
    const testAudit = await AuditLog.create({
      institutionId: testInst._id,
      actorUserId: testFaculty._id,
      actorEmail: testFaculty.email,
      actorRole: 'faculty',
      action: 'experiment.publish',
      targetDomain: 'curriculum',
      targetResourceId: testExp._id.toString(),
      ipAddress: '127.0.0.1',
      status: 'success',
      details: {
        experimentCode: 'EXP-NN-01',
        secretToken: 'should_be_stripped',
      },
    });
    createdIds['AuditLog'].push(testAudit._id);
    recordTest(
      'Live Integration',
      'Persists AuditLog entry and confirms sanitization on Atlas',
      (testAudit.details as Record<string, unknown>)?.['secretToken'] === '[REDACTED_BY_SECURITY_POLICY]'
    );
  } finally {
    // Non-destructive cleanup: Delete ONLY the exact test records created in this session
    console.log('\n  [CLEANUP] Cleaning up only the temporary test documents created in this verification run...');
    for (const id of createdIds['AuditLog']) {
      await AuditLog.deleteOne({ _id: id });
    }
    for (const id of createdIds['LearnerProfile']) {
      await LearnerProfile.deleteOne({ _id: id });
    }
    for (const id of createdIds['Experiment']) {
      await Experiment.deleteOne({ _id: id });
    }
    for (const id of createdIds['User']) {
      await User.deleteOne({ _id: id });
    }
    for (const id of createdIds['Laboratory']) {
      await Laboratory.deleteOne({ _id: id });
    }
    for (const id of createdIds['Subject']) {
      await Subject.deleteOne({ _id: id });
    }
    for (const id of createdIds['Course']) {
      await Course.deleteOne({ _id: id });
    }
    for (const id of createdIds['Department']) {
      await Department.deleteOne({ _id: id });
    }
    for (const id of createdIds['Institution']) {
      await Institution.deleteOne({ _id: id });
    }
    console.log('  [CLEANUP] Completed. All original records and test collections remain untouched.');
    await disconnectDatabase();
  }
}

async function main(): Promise<void> {
  console.log('================================================================');
  console.log('   PHASE 3A — MONGOOSE MODEL VERIFICATION & INTEGRATION SUITE   ');
  console.log('================================================================');

  try {
    await runSchemaValidationTests();
    runIndexVerificationTests();
    await runLiveAtlasIntegrationTests();

    console.log('\n================================================================');
    console.log('                        SUMMARY REPORT                          ');
    console.log('================================================================');
    const total = results.length;
    const passedCount = results.filter((r) => r.passed).length;
    const failedCount = total - passedCount;

    console.log(`Total Verification Checks : ${total}`);
    console.log(`Passed Checks             : ${passedCount}`);
    console.log(`Failed Checks             : ${failedCount}`);

    if (failedCount > 0) {
      console.error('\n[FAIL] One or more model verification tests failed.');
      process.exit(1);
    } else {
      console.log('\n[PASS] All model validation and index checks passed successfully.');
    }
  } catch (err: unknown) {
    console.error('\n[ERROR] Unexpected error during model verification:');
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
  main();
}
