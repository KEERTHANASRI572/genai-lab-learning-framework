import { connectDatabase, disconnectDatabase } from '../config/database';
import { Institution } from '../models/Institution';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Course } from '../models/Course';
import { Subject } from '../models/Subject';
import { Laboratory } from '../models/Laboratory';
import { Experiment } from '../models/Experiment';
import { Assessment } from '../models/Assessment';
import { LearningResource } from '../models/LearningResource';
import { hashPassword, validatePasswordStrength } from '../utils/password';

/**
 * Non-destructive initial lab environment provisioning script.
 * Only provisions records if they do not already exist.
 * Never resets or drops database collections.
 */
export async function seedLabEnvironment(): Promise<void> {
  console.log('================================================================');
  console.log('   PROVISIONING LAB ENVIRONMENT & CURRICULUM (PHASE 3D - 3F)    ');
  console.log('================================================================\n');

  await connectDatabase();

  try {
    const defaultPassword = process.env['SEED_PASSWORD'] || 'LabSecurePass2026!';
    const passValidation = validatePasswordStrength(defaultPassword);
    if (!passValidation.valid) {
      throw new Error(`Password policy violation: ${passValidation.message}`);
    }
    const defaultPasswordHash = await hashPassword(defaultPassword);

    // 1. Institution
    let institution = await Institution.findOne({ code: 'AIT' });
    if (!institution) {
      console.log('[PROVISION] Creating Institution: Apex Institute of Technology (AIT)...');
      institution = await Institution.create({
        name: 'Apex Institute of Technology',
        code: 'AIT',
        domain: 'apex.edu',
        type: 'university',
        status: 'active',
        adminEmail: 'dean.electronics@apex.edu',
        settings: {
          approvedEmailDomains: ['apex.edu'],
          approvedFacultyEmails: ['prof.elena@apex.edu'],
          approvedStudentEmails: ['rohan.sharma@apex.edu'],
        },
      });
      console.log(`  -> Institution created: ${institution._id.toString()}`);
    } else {
      console.log(`[SKIP] Institution 'AIT' already exists (${institution._id.toString()})`);
    }

    const tenantId = institution._id;

    // 2. Users
    // 2a. Platform Admin
    let platformAdmin = await User.findOne({ email: 'platform.admin@framework.internal' });
    if (!platformAdmin) {
      console.log('[PROVISION] Creating Platform Admin...');
      platformAdmin = await User.create({
        name: 'Platform Operations Administrator',
        email: 'platform.admin@framework.internal',
        passwordHash: defaultPasswordHash,
        role: 'platform-admin',
        status: 'active',
        profile: { designation: 'Platform Administrator' },
      });
      console.log(`  -> Platform Admin created: ${platformAdmin._id.toString()}`);
    }

    // 2b. College Admin
    let collegeAdmin = await User.findOne({ email: 'dean.electronics@apex.edu' });
    if (!collegeAdmin) {
      console.log('[PROVISION] Creating College Admin...');
      collegeAdmin = await User.create({
        name: 'Dr. Arthur Vance',
        email: 'dean.electronics@apex.edu',
        passwordHash: defaultPasswordHash,
        role: 'college-admin',
        institutionId: tenantId,
        status: 'active',
        profile: { designation: 'Dean of Engineering' },
      });
      console.log(`  -> College Admin created: ${collegeAdmin._id.toString()}`);
    }

    // 2c. Faculty
    let faculty = await User.findOne({ email: 'prof.elena@apex.edu' });
    if (!faculty) {
      console.log('[PROVISION] Creating Faculty User...');
      faculty = await User.create({
        name: 'Prof. Elena Rostova',
        email: 'prof.elena@apex.edu',
        passwordHash: defaultPasswordHash,
        role: 'faculty',
        institutionId: tenantId,
        status: 'active',
        profile: { designation: 'Associate Professor, ECE' },
      });
      console.log(`  -> Faculty created: ${faculty._id.toString()}`);
    }

    // 2d. Student
    let student = await User.findOne({ email: 'rohan.sharma@apex.edu' });
    if (!student) {
      console.log('[PROVISION] Creating Student User...');
      student = await User.create({
        name: 'Rohan Sharma',
        email: 'rohan.sharma@apex.edu',
        passwordHash: defaultPasswordHash,
        role: 'student',
        institutionId: tenantId,
        status: 'active',
        profile: { studentIdNumber: '24ECE099', designation: 'UG Student' },
      });
      console.log(`  -> Student created: ${student._id.toString()}`);
    }

    // 3. Academic Structure
    // 3a. Department
    let department = await Department.findOne({ institutionId: tenantId, code: 'ECE' });
    if (!department) {
      console.log('[PROVISION] Creating Department: Electronics & Communication Engineering...');
      department = await Department.create({
        institutionId: tenantId,
        name: 'Department of Electronics & Communication Engineering',
        code: 'ECE',
        status: 'active',
      });
    }

    // 3b. Course
    let course = await Course.findOne({ institutionId: tenantId, code: 'BTECH-ECE' });
    if (!course) {
      console.log('[PROVISION] Creating Course: B.Tech ECE...');
      course = await Course.create({
        institutionId: tenantId,
        departmentId: department._id,
        name: 'Bachelor of Technology in Electronics & Communication',
        code: 'BTECH-ECE',
        degreeLevel: 'undergraduate',
        totalSemesters: 8,
        status: 'active',
      });
    }

    // 3c. Subject
    let subject = await Subject.findOne({ institutionId: tenantId, code: 'ECE204' });
    if (!subject) {
      console.log('[PROVISION] Creating Subject: Analog Circuits...');
      subject = await Subject.create({
        institutionId: tenantId,
        departmentId: department._id,
        courseId: course._id,
        name: 'Analog Circuits',
        code: 'ECE204',
        credits: 4,
        semester: 4,
        status: 'active',
      });
    }

    // 3d. Laboratory
    let laboratory = await Laboratory.findOne({ institutionId: tenantId, code: 'ECE204L' });
    if (!laboratory) {
      console.log('[PROVISION] Creating Laboratory: Analog Circuits Laboratory...');
      laboratory = await Laboratory.create({
        institutionId: tenantId,
        departmentId: department._id,
        courseId: course._id,
        subjectId: subject._id,
        name: 'Analog Circuits Laboratory',
        code: 'ECE204L',
        status: 'active',
      });
    }

    // 4. Learning Resource (Curriculum Manual)
    let resource = await LearningResource.findOne({ institutionId: tenantId, title: 'Analog Circuits Laboratory Manual (Rev 2026)' });
    if (!resource) {
      console.log('[PROVISION] Creating Verified Learning Resource...');
      resource = await LearningResource.create({
        institutionId: tenantId,
        departmentId: department._id,
        courseId: course._id,
        subjectId: subject._id,
        laboratoryId: laboratory._id,
        title: 'Analog Circuits Laboratory Manual (Rev 2026)',
        description: 'Authorized laboratory manual detailing RC transients, op-amps, and active filters.',
        category: 'manual',
        format: 'PDF',
        originalFilename: 'analog_circuits_manual_2026.pdf',
        storageKey: 'courseware/ait/ece204l/analog_circuits_manual_2026.pdf',
        storageBucket: 'institutional-courseware',
        mimeType: 'application/pdf',
        fileSizeBytes: 2048576,
        ragIndexingStatus: 'ready',
        ragMetadata: {
          chunkCount: 24,
          embeddingModel: 'text-embedding-004',
          indexedAt: new Date(),
        },
        uploadedByUserId: faculty!._id,
        status: 'published',
        approvalStatus: 'approved',
      });
    }

    // 5. Experiment: EXP-01
    let experiment = await Experiment.findOne({ institutionId: tenantId, code: 'EXP-01' });
    if (!experiment) {
      console.log('[PROVISION] Creating Experiment: RC Circuit Transient Response & Time Constant...');
      experiment = await Experiment.create({
        institutionId: tenantId,
        departmentId: department._id,
        courseId: course._id,
        subjectId: subject._id,
        laboratoryId: laboratory._id,
        title: 'RC Circuit Transient Response & Time Constant',
        code: 'EXP-01',
        description: 'Investigate charging and discharging characteristics of series RC circuits using a Digital Storage Oscilloscope (DSO).',
        objectives: [
          'Measure and plot exponential charging and discharging voltage curves using a DSO.',
          'Experimentally verify the theoretical time constant τ = R × C against cursor measurements.',
          'Examine the influence of differing resistance and capacitance values on transient step duration.',
        ],
        equipment: [
          'Digital Storage Oscilloscope (DSO, 100 MHz, dual-channel)',
          'Function / Arbitrary Waveform Generator (Square wave output, 1 kHz, 5 Vpp)',
          'Decade Resistance Box (0.1% precision, 10 kΩ setting)',
          'Precision Capacitors (0.1 μF, 50 V ceramic/polyester)',
          'BNC-to-Alligator Probes and Breadboard jumper wires',
        ],
        prerequisites: [
          'Capacitor Transient Behavior',
          'Time Constant Calculation',
          'Kirchhoffs Voltage Law in RC Loops',
        ],
        safetyInstructions: [
          'Always turn off the waveform generator before modifying breadboard circuit wiring.',
          'Connect the oscilloscope probe ground clip exclusively to circuit common ground; never to active signal nodes.',
          'Verify capacitor discharge state before disconnecting apparatus terminals.',
        ],
        procedureSteps: [
          {
            stepNumber: 1,
            title: 'Apparatus Setup & Safety Inspection',
            instruction: 'Inspect all test leads for insulation damage. Set the function generator to 1 kHz square wave, 0 to 5 V DC offset.',
            expectedObservation: 'Square wave output validated on DSO Channel 1.',
            requiredApparatus: ['Function Generator', 'DSO'],
            verificationType: 'observation_check',
          },
          {
            stepNumber: 2,
            title: 'Series Circuit Breadboard Assembly',
            instruction: 'Wire a 10 kΩ resistor in series with a 0.1 μF capacitor on the breadboard. Connect generator output across the series combination.',
            expectedObservation: 'Complete series loop verified with common ground return.',
            requiredApparatus: ['Breadboard', '10k Resistor', '0.1uF Capacitor'],
            verificationType: 'observation_check',
          },
          {
            stepNumber: 3,
            title: 'Transient Voltage Measurement & Cursor Calibration',
            instruction: 'Connect DSO Channel 2 across the capacitor. Set DSO trigger to Channel 1 rising edge. Measure time required to reach 63.2% of peak voltage.',
            expectedObservation: 'Exponential rise curve displayed cleanly; measured time constant approximately 1.0 ms.',
            requiredApparatus: ['DSO', 'Probes'],
            verificationType: 'numeric_tolerance',
          },
          {
            stepNumber: 4,
            title: 'Time Constant Verification & Parameter Sweep',
            instruction: 'Record measured time constant τ. Calculate percentage error against theoretical value τ = 10 kΩ × 0.1 μF = 1.00 ms.',
            expectedObservation: 'Percentage error within acceptable lab tolerance (±5%).',
            requiredApparatus: ['Calculator'],
            verificationType: 'numeric_tolerance',
          },
          {
            stepNumber: 5,
            title: 'Discharge Curve Analysis & Final Verification',
            instruction: 'Trigger on falling edge of input square wave. Measure discharge time to 36.8% of maximum voltage.',
            expectedObservation: 'Symmetric discharging exponential curve observed and recorded.',
            requiredApparatus: ['DSO'],
            verificationType: 'observation_check',
          },
        ],
        approvedResourceIds: [resource!._id],
        estimatedDurationMins: 90,
        authorFacultyUserId: faculty!._id,
        topicTags: ['Capacitor Transient Behavior', 'Time Constant Calculation', 'RC Circuit Analysis'],
        status: 'published',
      });
      console.log(`  -> Experiment created: ${experiment._id.toString()}`);
    }

    // 6. Assessment: Diagnostic for EXP-01
    let assessment = await Assessment.findOne({ experimentId: experiment._id, type: 'initial_diagnostic' });
    if (!assessment) {
      console.log('[PROVISION] Creating Initial Diagnostic Assessment for EXP-01...');
      assessment = await Assessment.create({
        institutionId: tenantId,
        experimentId: experiment._id,
        type: 'initial_diagnostic',
        title: 'EXP-01 Pre-Lab Diagnostic: RC Circuit Transient Principles',
        description: 'Evaluates topic prerequisite mastery in capacitor transient dynamics and time constant formulation.',
        passingScorePercent: 60,
        timeLimitMins: 20,
        status: 'published',
        authorFacultyUserId: faculty!._id,
        questions: [
          {
            questionId: 'q1_rc_transient',
            topicTag: 'Capacitor Transient Behavior',
            prompt: 'At the exact instant a DC step voltage is applied across an initially uncharged series RC circuit (t = 0+), what is the voltage across the capacitor?',
            options: [
              { optionId: 'opt_a', text: 'Equal to the applied DC supply voltage (V_supply)' },
              { optionId: 'opt_b', text: 'Zero volts (0 V), because the charge cannot change instantaneously' },
              { optionId: 'opt_c', text: '63.2% of the applied DC supply voltage' },
              { optionId: 'opt_d', text: 'Infinitely high voltage spike' },
            ],
            correctOptionId: 'opt_b',
            explanation: 'By the capacitor continuity principle (q = Cv), the voltage across an ideal capacitor cannot change instantaneously without an infinite current.',
            difficulty: 'beginner',
            weight: 10,
          },
          {
            questionId: 'q2_tau_calc',
            topicTag: 'Time Constant Calculation',
            prompt: 'In a series RC circuit with R = 10 kΩ and C = 0.1 μF, what is the theoretical time constant τ?',
            options: [
              { optionId: 'opt_a', text: '1.0 ms' },
              { optionId: 'opt_b', text: '10.0 ms' },
              { optionId: 'opt_c', text: '0.1 ms' },
              { optionId: 'opt_d', text: '100.0 ms' },
            ],
            correctOptionId: 'opt_a',
            explanation: 'τ = R × C = (10 × 10^3 Ω) × (0.1 × 10^-6 F) = 1.0 × 10^-3 s = 1.0 ms.',
            difficulty: 'intermediate',
            weight: 10,
          },
          {
            questionId: 'q3_discharge_rule',
            topicTag: 'RC Circuit Analysis',
            prompt: 'After approximately how many time constants (τ) is an RC circuit considered fully charged or discharged for practical laboratory analysis (>99.3%)?',
            options: [
              { optionId: 'opt_a', text: '1 time constant (1τ)' },
              { optionId: 'opt_b', text: '3 time constants (3τ)' },
              { optionId: 'opt_c', text: '5 time constants (5τ)' },
              { optionId: 'opt_d', text: '10 time constants (10τ)' },
            ],
            correctOptionId: 'opt_c',
            explanation: 'At t = 5τ, the exponential term is 1 - e^-5 ≈ 0.9933 (99.33%), which is the universal standard for steady-state completion in laboratory engineering.',
            difficulty: 'intermediate',
            weight: 10,
          },
        ],
      });
      console.log(`  -> Diagnostic Assessment created: ${assessment._id.toString()}`);
    }

    console.log('\n[SUCCESS] Lab Environment provisioned successfully!');
    console.log('Credentials Summary:');
    console.log('  Platform Admin : platform.admin@framework.internal / LabSecurePass2026!');
    console.log('  College Admin  : dean.electronics@apex.edu         / LabSecurePass2026!');
    console.log('  Faculty        : prof.elena@apex.edu               / LabSecurePass2026!');
    console.log('  Student        : rohan.sharma@apex.edu             / LabSecurePass2026!');
  } finally {
    await disconnectDatabase();
  }
}

if (require.main === module) {
  seedLabEnvironment().catch((err) => {
    console.error('Provisioning failed:', err);
    process.exit(1);
  });
}
