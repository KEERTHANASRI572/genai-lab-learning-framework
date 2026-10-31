import mongoose from 'mongoose';
import { Request, Response } from 'express';
import { User } from '../models/User';
import { Department } from '../models/Department';
import { Laboratory } from '../models/Laboratory';
import { Experiment } from '../models/Experiment';
import { Assessment } from '../models/Assessment';
import { LearningResource } from '../models/LearningResource';
import { LearningSession } from '../models/LearningSession';
import { HelpRequest, IHelpRequest } from '../models/HelpRequest';
import { AssessmentAttempt } from '../models/AssessmentAttempt';
import {
  ensureDatabaseReady,
  sendError,
  sendSuccess,
} from '../utils/apiResponse';

/**
 * Get college-level analytics aggregated strictly from MongoDB Atlas for the authenticated tenant.
 */
export const getCollegeAnalytics = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const [
      totalSessions,
      completedSessions,
      activeStudents,
      departmentsCount,
      laboratoriesCount,
      resourcesCount,
      sessionTelemetryAgg,
    ] = await Promise.all([
      LearningSession.countDocuments({ institutionId: tenantId }),
      LearningSession.countDocuments({ institutionId: tenantId, sessionStatus: 'completed' }),
      User.countDocuments({ institutionId: tenantId, role: 'student', status: 'active' }),
      Department.countDocuments({ institutionId: tenantId, status: { $ne: 'archived' } }),
      Laboratory.countDocuments({ institutionId: tenantId, status: { $in: ['active', 'maintenance'] } }),
      LearningResource.countDocuments({ institutionId: tenantId, status: { $ne: 'archived' } }),
      LearningSession.aggregate([
        { $match: { institutionId: new mongoose.Types.ObjectId(tenantId.toString()) } },
        {
          $group: {
            _id: null,
            totalAiQueries: { $sum: '$telemetry.aiQueriesCount' },
            totalEscalations: { $sum: '$telemetry.escalationsCount' },
          },
        },
      ]),
    ]);

    const completionRatePercent =
      totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : null;

    const aiInvocations =
      sessionTelemetryAgg.length > 0 ? sessionTelemetryAgg[0].totalAiQueries || 0 : 0;

    // Fetch department list with lab counts
    const departments = await Department.find({
      institutionId: tenantId,
      status: { $ne: 'archived' },
    }).select('name code');

    const departmentalEngagement = await Promise.all(
      departments.map(async (dept) => {
        const [labsInDept, studentsInDept] = await Promise.all([
          Laboratory.countDocuments({ institutionId: tenantId, departmentId: dept._id, status: { $in: ['active', 'maintenance'] } }),
          User.countDocuments({ institutionId: tenantId, departmentId: dept._id, role: 'student' }),
        ]);
        return {
          departmentId: dept._id,
          name: dept.name,
          code: dept.code,
          labsCount: labsInDept,
          studentsCount: studentsInDept,
        };
      })
    );

    sendSuccess(res, {
      scheduledSessions: totalSessions,
      completedSessions,
      activeStudents,
      departmentsCount,
      laboratoriesCount,
      learningResourcesCount: resourcesCount,
      completionRatePercent,
      aiInvocations,
      departmentalEngagement,
    }, { message: 'College analytics aggregated successfully.' });
  } catch (err: unknown) {
    sendError(res, 'ANALYTICS_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * Get college overview data (metrics and departmental structure) strictly for the authenticated tenant.
 */
export const getCollegeOverview = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const [
      departments,
      laboratoriesCount,
      enrolledStudentsCount,
      approvedManualsCount,
    ] = await Promise.all([
      Department.find({ institutionId: tenantId, status: { $ne: 'archived' } }).sort({ name: 1 }),
      Laboratory.countDocuments({ institutionId: tenantId, status: { $in: ['active', 'maintenance'] } }),
      User.countDocuments({ institutionId: tenantId, role: 'student', status: 'active' }),
      LearningResource.countDocuments({ institutionId: tenantId, status: { $ne: 'archived' } }),
    ]);

    // For each department, get genuine child counts
    const departmentSummaries = await Promise.all(
      departments.map(async (dept) => {
        const [labsCount, studentsCount] = await Promise.all([
          Laboratory.countDocuments({ institutionId: tenantId, departmentId: dept._id, status: { $in: ['active', 'maintenance'] } }),
          User.countDocuments({ institutionId: tenantId, departmentId: dept._id, role: 'student' }),
        ]);

        // Experiments under this department's labs
        const labIds = await Laboratory.find({ institutionId: tenantId, departmentId: dept._id }).distinct('_id');
        const experimentsCount = await Experiment.countDocuments({
          institutionId: tenantId,
          laboratoryId: { $in: labIds },
          status: { $ne: 'archived' },
        });

        return {
          id: dept._id.toString(),
          name: dept.name,
          code: dept.code,
          status: dept.status,
          labsCount,
          experimentsCount,
          studentsCount,
        };
      })
    );

    sendSuccess(res, {
      departmentsCount: departments.length,
      laboratoriesCount,
      enrolledStudentsCount,
      approvedManualsCount,
      departments: departmentSummaries,
    }, { message: 'College overview data retrieved.' });
  } catch (err: unknown) {
    sendError(res, 'OVERVIEW_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * Get student early-warning interventions strictly for the authenticated tenant.
 */
export const getStudentInterventions = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const interventions: Array<{
      id: string;
      studentName: string;
      studentId: string;
      department: string;
      currentExperiment: string;
      flagReason: string;
      severity: 'high' | 'medium' | 'low';
      assignedFaculty: string;
      status: 'pending_intervention' | 'reviewed';
    }> = [];

    // 1. Check open HelpRequests (live in-lab escalations)
    const pendingHelpRequests = await HelpRequest.find({
      institutionId: tenantId,
      status: { $in: ['pending_review', 'in_progress'] },
    })
      .populate('studentId', 'name email departmentId')
      .populate('assignedFacultyUserId', 'name email')
      .populate('experimentId', 'title')
      .sort({ createdAt: -1 });

    for (const hr of pendingHelpRequests) {
      const student = hr.studentId as unknown as { name?: string; email?: string; departmentId?: mongoose.Types.ObjectId };
      const faculty = hr.assignedFacultyUserId as unknown as { name?: string };
      let deptName = 'Unassigned';
      if (student?.departmentId) {
        const dept = await Department.findById(student.departmentId).select('code name');
        if (dept) deptName = dept.code || dept.name;
      }

      interventions.push({
        id: (hr._id as mongoose.Types.ObjectId).toString(),
        studentName: student?.name || hr.studentName || 'Student',
        studentId: (hr.studentId as unknown as { _id: mongoose.Types.ObjectId })?._id?.toString() || 'N/A',
        department: deptName,
        currentExperiment: hr.experimentTitle || (hr.experimentId as unknown as { title?: string })?.title || 'Experiment',
        flagReason: `Help Request: ${hr.studentQuery} (Reason: ${hr.escalationReason.replace(/_/g, ' ')})`,
        severity: hr.escalationReason === 'safety_boundary' || hr.escalationReason === 'repeated_error' ? 'high' : 'medium',
        assignedFaculty: faculty?.name || 'Unassigned Faculty',
        status: 'pending_intervention',
      });
    }

    // 2. Check diagnostic assessment attempts with score < 50%
    const lowScoreAttempts = await AssessmentAttempt.find({
      institutionId: tenantId,
      scorePercent: { $lt: 50 },
    })
      .populate('studentId', 'name email departmentId')
      .populate('experimentId', 'title')
      .sort({ createdAt: -1 })
      .limit(20);

    for (const attempt of lowScoreAttempts) {
      const student = attempt.studentId as unknown as { _id?: mongoose.Types.ObjectId; name?: string; departmentId?: mongoose.Types.ObjectId };
      if (!student) continue;

      let deptName = 'Unassigned';
      if (student.departmentId) {
        const dept = await Department.findById(student.departmentId).select('code name');
        if (dept) deptName = dept.code || dept.name;
      }

      interventions.push({
        id: (attempt._id as mongoose.Types.ObjectId).toString(),
        studentName: student.name || 'Student',
        studentId: student._id?.toString() || 'N/A',
        department: deptName,
        currentExperiment: (attempt.experimentId as unknown as { title?: string })?.title || 'Assessment',
        flagReason: `Low diagnostic score (${attempt.scorePercent}%) on prerequisite knowledge`,
        severity: attempt.scorePercent < 30 ? 'high' : 'medium',
        assignedFaculty: 'Assigned Course Faculty',
        status: 'pending_intervention',
      });
    }

    sendSuccess(res, interventions, { message: 'Student interventions retrieved.' });
  } catch (err: unknown) {
    sendError(res, 'INTERVENTIONS_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * Get faculty participation and oversight metrics strictly for the authenticated tenant.
 */
export const getFacultyOversight = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const facultyUsers = await User.find({
      institutionId: tenantId,
      role: 'faculty',
    })
      .populate('departmentId', 'name code')
      .sort({ name: 1 });

    const facultyMetrics = await Promise.all(
      facultyUsers.map(async (f) => {
        const [authoredLabs, approvedDocs, escalationsAnswered] = await Promise.all([
          Experiment.countDocuments({
            institutionId: tenantId,
            status: { $ne: 'archived' },
          }), // Labs/experiments in tenant
          LearningResource.countDocuments({
            institutionId: tenantId,
            uploadedByUserId: f._id,
            status: { $ne: 'archived' },
          }),
          HelpRequest.countDocuments({
            institutionId: tenantId,
            status: 'resolved',
            'resolution.resolvedByUserId': f._id,
          }),
        ]);

        const dept = f.departmentId as unknown as { name?: string; code?: string } | undefined;

        return {
          id: f._id.toString(),
          name: f.name,
          email: f.email,
          dept: dept?.code || dept?.name || 'General',
          role: 'Faculty Member',
          authoredLabs,
          approvedDocs,
          escalationsAnswered,
          avgResponseTime: escalationsAnswered > 0 ? 'Recorded' : 'No activity recorded',
        };
      })
    );

    sendSuccess(res, facultyMetrics, { message: 'Faculty oversight data retrieved.' });
  } catch (err: unknown) {
    sendError(res, 'FACULTY_OVERSIGHT_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * Get assignment-based faculty dashboard metrics strictly from MongoDB Atlas.
 */
export const getFacultyDashboard = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const facultyUserId = req.user?.id;
  if (!tenantId || !facultyUserId) {
    sendError(res, 'NO_TENANT_OR_USER', 'Faculty session required.', 403, undefined, req);
    return;
  }
  if (!ensureDatabaseReady(req, res)) return;

  try {
    const facultyUser = await User.findOne({ _id: facultyUserId, institutionId: tenantId })
      .populate('departmentId', 'name code')
      .populate('courseId', 'name code');

    if (!facultyUser) {
      sendError(res, 'USER_NOT_FOUND', 'Faculty user record not found.', 404, undefined, req);
      return;
    }

    const deptId = facultyUser.departmentId
      ? ((facultyUser.departmentId as unknown as { _id?: mongoose.Types.ObjectId })._id || facultyUser.departmentId)
      : undefined;
    const courseId = facultyUser.courseId
      ? ((facultyUser.courseId as unknown as { _id?: mongoose.Types.ObjectId })._id || facultyUser.courseId)
      : undefined;
    const enrolledCourseIds = facultyUser.profile?.enrolledCourseIds || [];

    // Find authorized laboratories
    const labQuery: Record<string, unknown> = {
      institutionId: tenantId,
      status: { $in: ['active', 'maintenance'] },
    };

    const labOrConditions: Record<string, unknown>[] = [];
    if (courseId) {
      labOrConditions.push({ courseId });
    }
    if (enrolledCourseIds.length > 0) {
      labOrConditions.push({ courseId: { $in: enrolledCourseIds } });
    }
    if (deptId && !courseId && enrolledCourseIds.length === 0) {
      labOrConditions.push({ departmentId: deptId });
    }
    labOrConditions.push({ facultyInChargeUserId: facultyUser._id });

    labQuery['$or'] = labOrConditions;

    const assignedLabs = await Laboratory.find(labQuery).populate('courseId', 'name code').lean();
    const labIds = assignedLabs.map((l) => l._id);

    // Also check if faculty authored any experiments directly
    const authoredExps = await Experiment.find({
      institutionId: tenantId,
      authorFacultyUserId: facultyUser._id,
      status: { $ne: 'archived' },
    }).lean();

    const allLabIds = Array.from(new Set([...labIds, ...authoredExps.map((e) => e.laboratoryId)]));

    // Experiments belonging to authorized labs or authored by faculty
    const experiments = await Experiment.find({
      institutionId: tenantId,
      status: { $ne: 'archived' },
      $or: [
        { laboratoryId: { $in: allLabIds } },
        { authorFacultyUserId: facultyUser._id },
      ],
    })
      .populate('laboratoryId', 'name code')
      .lean();

    const experimentIds = experiments.map((e) => e._id);

    // Enrolled students belonging to the faculty's assigned course/department
    const studentQuery: Record<string, unknown> = {
      institutionId: tenantId,
      role: 'student',
      status: 'active',
    };
    if (courseId) {
      studentQuery['$or'] = [
        { courseId },
        { 'profile.enrolledCourseIds': courseId },
      ];
    } else if (deptId) {
      studentQuery['departmentId'] = deptId;
    }

    const [enrolledStudentsCount, pendingEscalationsRaw] = await Promise.all([
      User.countDocuments(studentQuery),
      HelpRequest.find({
        institutionId: tenantId,
        status: { $in: ['pending_review', 'in_progress'] },
        $or: [
          { experimentId: { $in: experimentIds } },
          { assignedFacultyUserId: facultyUserId },
        ],
      })
        .sort({ createdAt: -1 })
        .limit(10)
        .lean(),
    ]);

    const pendingEscalations = pendingEscalationsRaw as unknown as (IHelpRequest & { _id: mongoose.Types.ObjectId })[];

    // Format experiments list with live counts
    const experimentCurriculum = await Promise.all(
      experiments.map(async (exp) => {
        const [diagnosticAssessment, activeLearnersCount] = await Promise.all([
          Assessment.findOne({
            experimentId: exp._id,
            institutionId: tenantId,
            type: 'initial_diagnostic',
          }).lean(),
          LearningSession.countDocuments({
            experimentId: exp._id,
            sessionStatus: 'in_progress',
          }),
        ]);

        const lab = exp.laboratoryId as unknown as { name?: string; code?: string } | undefined;

        return {
          id: exp._id.toString(),
          title: exp.title,
          code: exp.code,
          labName: lab?.name || 'Assigned Laboratory',
          labCode: lab?.code || 'LAB',
          diagnosticQuiz: diagnosticAssessment
            ? {
                configured: true,
                questionCount: diagnosticAssessment.questions?.length || 0,
                status: diagnosticAssessment.status,
              }
            : {
                configured: false,
                questionCount: 0,
                status: 'not_configured',
              },
          safetyProtocol: {
            hasSafetyRules: Array.isArray(exp.safetyInstructions) && exp.safetyInstructions.length > 0,
            safetyNoticeCount: exp.safetyInstructions?.length || 0,
          },
          activeLearners: activeLearnersCount,
          stepCount: exp.procedureSteps?.length || 0,
          equipmentCount: exp.equipment?.length || 0,
        };
      })
    );

    const hasAssignment = Boolean(courseId || deptId || assignedLabs.length > 0 || authoredExps.length > 0);

    sendSuccess(res, {
      hasAssignment,
      faculty: {
        id: facultyUser._id.toString(),
        name: facultyUser.name,
        email: facultyUser.email,
        department: (facultyUser.departmentId as unknown as { name?: string; code?: string })?.name,
        departmentCode: (facultyUser.departmentId as unknown as { name?: string; code?: string })?.code,
        course: (facultyUser.courseId as unknown as { name?: string; code?: string })?.name,
        courseCode: (facultyUser.courseId as unknown as { name?: string; code?: string })?.code,
      },
      metrics: {
        assignedLabsCount: assignedLabs.length,
        activeExperimentsCount: experiments.filter((e) => e.status === 'published' || e.status === 'review_pending').length,
        totalExperimentsCount: experiments.length,
        enrolledStudentsCount,
        pendingEscalationsCount: pendingEscalations.length,
      },
      experiments: experimentCurriculum,
      pendingEscalations: pendingEscalations.map((esc) => ({
        id: esc._id.toString(),
        studentName: esc.studentName,
        experimentTitle: esc.experimentTitle,
        stepNumber: esc.stepNumber,
        escalationReason: esc.escalationReason,
        studentQuery: esc.studentQuery,
        createdAt: esc.createdAt,
      })),
    });
  } catch (err: unknown) {
    sendError(res, 'FACULTY_DASHBOARD_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * Get faculty assessment analytics calculated strictly from MongoDB Atlas attempts.
 */
export const getFacultyAnalytics = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const facultyUserId = req.user?.id;
  if (!tenantId || !facultyUserId) {
    sendError(res, 'NO_TENANT_OR_USER', 'Faculty session required.', 403, undefined, req);
    return;
  }
  if (!ensureDatabaseReady(req, res)) return;

  try {
    const facultyUser = await User.findOne({ _id: facultyUserId, institutionId: tenantId });
    const courseId = facultyUser?.courseId;
    const deptId = facultyUser?.departmentId;

    const expQuery: Record<string, unknown> = { institutionId: tenantId, status: { $ne: 'archived' } };
    if (courseId) {
      expQuery['courseId'] = courseId;
    } else if (deptId) {
      expQuery['departmentId'] = deptId;
    }

    const experiments = await Experiment.find(expQuery).lean();
    const expIds = experiments.map((e) => e._id);

    // Query genuine attempts
    const [diagnosticAttempts, summativeAttempts, totalLearningResources] = await Promise.all([
      AssessmentAttempt.find({
        institutionId: tenantId,
        experimentId: { $in: expIds },
        type: 'initial_diagnostic',
        status: 'completed',
      }).lean(),
      AssessmentAttempt.find({
        institutionId: tenantId,
        experimentId: { $in: expIds },
        type: 'final_summative',
        status: 'completed',
      }).lean(),
      LearningResource.countDocuments({
        institutionId: tenantId,
        status: { $ne: 'archived' },
      }),
    ]);

    const hasAttempts = diagnosticAttempts.length > 0 || summativeAttempts.length > 0;

    let diagnosticAvg: number | null = null;
    let summativeAvg: number | null = null;
    let avgDurationMins: number | null = null;

    if (diagnosticAttempts.length > 0) {
      const sum = diagnosticAttempts.reduce((acc, a) => acc + (a.scorePercent || 0), 0);
      diagnosticAvg = Math.round((sum / diagnosticAttempts.length) * 10) / 10;
    }

    if (summativeAttempts.length > 0) {
      const sum = summativeAttempts.reduce((acc, a) => acc + (a.scorePercent || 0), 0);
      summativeAvg = Math.round((sum / summativeAttempts.length) * 10) / 10;
    }

    const allCompletedAttempts = [...diagnosticAttempts, ...summativeAttempts];
    if (allCompletedAttempts.length > 0) {
      const totalSec = allCompletedAttempts.reduce((acc, a) => acc + (a.durationSeconds || 0), 0);
      avgDurationMins = Math.round((totalSec / allCompletedAttempts.length) / 60);
    }

    // Step performance matrix from attempts
    const stepMatrix: { step: string; avgScore: number; attemptsCount: number }[] = [];
    if (hasAttempts) {
      const conceptMap = new Map<string, { totalScore: number; count: number }>();
      for (const att of diagnosticAttempts) {
        if (Array.isArray(att.topicProficiencyEvidence)) {
          for (const ev of att.topicProficiencyEvidence) {
            const cur = conceptMap.get(ev.topicTag) || { totalScore: 0, count: 0 };
            cur.totalScore += ev.calculatedScore;
            cur.count += 1;
            conceptMap.set(ev.topicTag, cur);
          }
        }
      }
      for (const [topic, data] of conceptMap.entries()) {
        stepMatrix.push({
          step: topic,
          avgScore: Math.round(data.totalScore / data.count),
          attemptsCount: data.count,
        });
      }
    }

    sendSuccess(res, {
      hasAttempts,
      diagnosticAvg,
      summativeAvg,
      avgDurationMins,
      learningResourcesCount: totalLearningResources,
      totalDiagnosticAttempts: diagnosticAttempts.length,
      totalSummativeAttempts: summativeAttempts.length,
      stepMatrix,
    });
  } catch (err: unknown) {
    sendError(res, 'FACULTY_ANALYTICS_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * Get aggregated conceptual learning gaps from genuine student assessment attempts.
 */
export const getFacultyLearningGaps = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const facultyUserId = req.user?.id;
  if (!tenantId || !facultyUserId) {
    sendError(res, 'NO_TENANT_OR_USER', 'Faculty session required.', 403, undefined, req);
    return;
  }
  if (!ensureDatabaseReady(req, res)) return;

  try {
    const facultyUser = await User.findOne({ _id: facultyUserId, institutionId: tenantId });
    const courseId = facultyUser?.courseId;
    const deptId = facultyUser?.departmentId;

    const expQuery: Record<string, unknown> = { institutionId: tenantId, status: { $ne: 'archived' } };
    if (courseId) {
      expQuery['courseId'] = courseId;
    } else if (deptId) {
      expQuery['departmentId'] = deptId;
    }

    const experiments = await Experiment.find(expQuery).lean();
    const expIds = experiments.map((e) => e._id);

    const attempts = await AssessmentAttempt.find({
      institutionId: tenantId,
      experimentId: { $in: expIds },
      status: 'completed',
    }).lean();

    const topicStats = new Map<
      string,
      {
        topic: string;
        errorCount: number;
        affectedStudentIds: Set<string>;
        remedy: string;
        scores: number[];
      }
    >();

    for (const att of attempts) {
      const studentId = att.studentId?.toString() || 'unknown';
      if (Array.isArray(att.topicProficiencyEvidence)) {
        for (const ev of att.topicProficiencyEvidence) {
          const incorrect = ev.questionsTotal - ev.questionsCorrect;
          if (incorrect > 0 || (att.prerequisiteGaps && att.prerequisiteGaps.includes(ev.topicTag))) {
            const entry = topicStats.get(ev.topicTag) || {
              topic: ev.topicTag,
              errorCount: 0,
              affectedStudentIds: new Set<string>(),
              remedy: att.diagnosisExplanation || 'Scaffolded practice and prerequisite concept revision recommended.',
              scores: [],
            };
            entry.errorCount += incorrect;
            entry.affectedStudentIds.add(studentId);
            entry.scores.push(ev.calculatedScore);
            topicStats.set(ev.topicTag, entry);
          }
        }
      }
    }

    const gaps = Array.from(topicStats.values()).map((g) => {
      const avgScore = g.scores.length > 0 ? g.scores.reduce((a, b) => a + b, 0) / g.scores.length : 0;
      const severity: 'high' | 'medium' = g.errorCount >= 3 || avgScore < 50 ? 'high' : 'medium';
      return {
        topic: g.topic,
        errorCount: g.errorCount,
        severity,
        affectedStudents: g.affectedStudentIds.size,
        rootCause: `Identified conceptual difficulty (${Math.round(avgScore)}% average mastery) during initial diagnostic quiz.`,
        remedy: g.remedy,
      };
    });

    sendSuccess(res, gaps, { message: 'Faculty learning gaps retrieved.' });
  } catch (err: unknown) {
    sendError(res, 'LEARNING_GAPS_FAILED', (err as Error).message, 500, undefined, req);
  }
};
