const rawApiBase = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_API_BASE_URL : undefined;
const rawBackendBase = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_BACKEND_URL : undefined;

const API_BASE =
  rawApiBase ||
  (rawBackendBase ? `${rawBackendBase.replace(/\/+$/, '')}/api/v1` : '') ||
  'http://localhost:5000/api/v1';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  pagination?: {
    page: number;
    limit: number;
    totalRecords: number;
    totalPages: number;
  };
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/**
 * Common fetch wrapper that sends standard JSON headers, includes credentials (HttpOnly cookies),
 * and parses error envelopes.
 */
async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    ...(options.headers as Record<string, string>),
  };

  if (typeof FormData !== 'undefined' && options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    const json = await res.json().catch(() => null);

    if (!res.ok) {
      return {
        success: false,
        error: json?.error || {
          code: `HTTP_${res.status}`,
          message: res.statusText || 'Request failed.',
        },
      };
    }

    return json as ApiResponse<T>;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Network connection to backend failed.';
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: `${message}. Ensure backend is running at http://localhost:5000.`,
      },
    };
  }
}

/* ==========================================================================
   AUTHENTICATION API
   ========================================================================== */
export interface AuthUserDto {
  id: string;
  name: string;
  email: string;
  role: 'platform-admin' | 'college-admin' | 'faculty' | 'student';
  institutionId: string | null;
  institution?: {
    _id: string;
    name: string;
    code: string;
    domain: string;
  } | null;
  departmentId?: string | null;
  status: string;
  lastLoginAt?: string;
  profile?: {
    avatarUrl?: string;
    phone?: string;
    designation?: string;
    studentIdNumber?: string;
  };
}

export const loginUser = async (credentials: { email: string; password: string }) => {
  return request<{ user: AuthUserDto; tokens: { accessToken: string; refreshToken: string } }>(
    '/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(credentials),
    }
  );
};

export const logoutUser = async () => {
  return request<{ message: string }>('/auth/logout', {
    method: 'POST',
  });
};

export const getCurrentUser = async () => {
  return request<AuthUserDto>('/auth/me', {
    method: 'GET',
  });
};

export const refreshSession = async () => {
  return request<{ tokens: { accessToken: string; refreshToken: string } }>('/auth/refresh', {
    method: 'POST',
  });
};

export const activateAccount = async (payload: { token: string; password: string }) => {
  return request<{ message: string; user: AuthUserDto }>('/auth/activate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const requestPasswordReset = async (payload: { email: string }) => {
  return request<{ message: string }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const resetPassword = async (payload: { token: string; newPassword: string }) => {
  return request<{ message: string }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

/* ==========================================================================
   INSTITUTIONS API
   ========================================================================== */
export interface InstitutionDto {
  _id: string;
  name: string;
  code: string;
  domain: string;
  type: string;
  otherInstitutionType?: string;
  status: 'active' | 'pending_activation' | 'suspended' | 'trial';
  adminEmail: string;
  contactPhone?: string;
  createdAt: string;
}

export interface EmailDeliverySummary {
  recipient: string;
  delivered: boolean;
  reason?: string;
  error?: string;
  expiresAt?: string;
}

export interface CreateInstitutionResult {
  institution: InstitutionDto;
  collegeAdmin?: {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
  };
  emailDelivery?: EmailDeliverySummary;
}

export const getInstitutions = async (query?: { status?: string; search?: string }) => {
  const params = new URLSearchParams();
  if (query?.status && query.status !== 'all') params.set('status', query.status);
  if (query?.search) params.set('search', query.search);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return request<InstitutionDto[]>(`/institutions${qStr}`);
};

export const createInstitution = async (payload: {
  name: string;
  code: string;
  domain: string;
  type: string;
  otherInstitutionType?: string;
  adminEmail: string;
}) => {
  return request<CreateInstitutionResult | InstitutionDto>('/institutions', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateInstitution = async (id: string, payload: Partial<InstitutionDto>) => {
  return request<InstitutionDto>(`/institutions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const deleteInstitution = async (id: string) => {
  return request<{ message: string }>(`/institutions/${id}`, {
    method: 'DELETE',
  });
};

export const suspendInstitution = async (id: string) => {
  return request<InstitutionDto>(`/institutions/${id}/suspend`, {
    method: 'POST',
  });
};

export const reactivateInstitution = async (id: string) => {
  return request<InstitutionDto>(`/institutions/${id}/reactivate`, {
    method: 'POST',
  });
};

export const deleteInstitutionPermanently = async (id: string) => {
  return request<{ deletedId: string; message: string }>(`/institutions/${id}/permanent`, {
    method: 'DELETE',
  });
};

export const resendInstitutionAdminInvitation = async (id: string) => {
  return request<{
    institutionId: string;
    adminEmail: string;
    emailDelivery: EmailDeliverySummary;
  }>(`/institutions/${id}/resend-admin-invitation`, {
    method: 'POST',
  });
};

/* ==========================================================================
   DEPARTMENTS API
   ========================================================================== */
export interface DepartmentDto {
  _id: string;
  institutionId: string;
  name: string;
  code: string;
  headOfDepartment?: string;
  description?: string;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
}

export const getDepartments = async (query?: { status?: string; search?: string }) => {
  const params = new URLSearchParams();
  if (query?.status && query.status !== 'all') params.set('status', query.status);
  if (query?.search) params.set('search', query.search);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return request<DepartmentDto[]>(`/departments${qStr}`);
};

export const createDepartment = async (payload: {
  name: string;
  code: string;
  headOfDepartment?: string;
  description?: string;
}) => {
  return request<DepartmentDto>('/departments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateDepartment = async (id: string, payload: Partial<DepartmentDto>) => {
  return request<DepartmentDto>(`/departments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const deleteDepartment = async (id: string) => {
  return request<{ message: string }>(`/departments/${id}`, {
    method: 'DELETE',
  });
};

export const deleteDepartmentPermanently = async (id: string) => {
  return request<{ deletedId: string; message: string }>(`/departments/${id}/permanent`, {
    method: 'DELETE',
  });
};

/* ==========================================================================
   COURSES API
   ========================================================================== */
export interface CourseDto {
  _id: string;
  institutionId: string;
  departmentId: string | { _id: string; name: string; code: string };
  name: string;
  code: string;
  degreeLevel: string;
  totalSemesters: number;
  status: 'active' | 'inactive' | 'archived';
  createdAt: string;
}

export const getCourses = async (query?: { departmentId?: string; status?: string; search?: string }) => {
  const params = new URLSearchParams();
  if (query?.departmentId) params.set('departmentId', query.departmentId);
  if (query?.status && query.status !== 'all') params.set('status', query.status);
  if (query?.search) params.set('search', query.search);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return request<CourseDto[]>(`/courses${qStr}`);
};

export const createCourse = async (payload: {
  departmentId: string;
  name: string;
  code: string;
  degreeLevel?: string;
  totalSemesters?: number;
}) => {
  return request<CourseDto>('/courses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateCourse = async (id: string, payload: Partial<CourseDto>) => {
  return request<CourseDto>(`/courses/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const deleteCourse = async (id: string) => {
  return request<{ message: string }>(`/courses/${id}`, {
    method: 'DELETE',
  });
};

export const deleteCoursePermanently = async (id: string) => {
  return request<{ deletedId: string; message: string }>(`/courses/${id}/permanent`, {
    method: 'DELETE',
  });
};

/* ==========================================================================
   USERS API
   ========================================================================== */
export interface UserDto {
  _id: string;
  name: string;
  email: string;
  role: 'platform-admin' | 'college-admin' | 'faculty' | 'student';
  institutionId?: string;
  departmentId?: string | { _id: string; name: string; code: string };
  courseId?: string | { _id: string; name: string; code: string; degreeLevel?: string };
  status: 'active' | 'inactive' | 'suspended' | 'pending_activation';
  createdAt: string;
}

export const getUsers = async (query?: { role?: string; departmentId?: string; courseId?: string; status?: string; search?: string }) => {
  const params = new URLSearchParams();
  if (query?.role && query.role !== 'all') params.set('role', query.role);
  if (query?.departmentId) params.set('departmentId', query.departmentId);
  if (query?.courseId) params.set('courseId', query.courseId);
  if (query?.status && query.status !== 'all') params.set('status', query.status);
  if (query?.search) params.set('search', query.search);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return request<UserDto[]>(`/users${qStr}`);
};

export const createUser = async (payload: {
  name: string;
  email: string;
  password?: string;
  role: string;
  departmentId?: string;
  courseId?: string;
}) => {
  return request<UserDto>('/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export interface InviteUserResponse {
  user: UserDto;
  emailDelivery: EmailDeliverySummary;
}

export interface ResendInviteResponse {
  userId: string;
  email: string;
  emailDelivery: EmailDeliverySummary;
}

export const inviteUser = async (payload: {
  name: string;
  email: string;
  role: string;
  departmentId?: string;
  courseId?: string;
}) => {
  return request<InviteUserResponse>('/users/invite', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateUser = async (id: string, payload: Partial<UserDto>) => {
  return request<UserDto>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const deleteUser = async (id: string) => {
  return request<{ message: string }>(`/users/${id}`, {
    method: 'DELETE',
  });
};

export const reactivateUser = async (id: string) => {
  return request<UserDto>(`/users/${id}/reactivate`, {
    method: 'POST',
  });
};

export const deleteUserPermanently = async (id: string) => {
  return request<{ deletedId: string; message: string }>(`/users/${id}/permanent`, {
    method: 'DELETE',
  });
};

export const resendUserInvitation = async (id: string) => {
  return request<ResendInviteResponse>(`/users/${id}/resend-invite`, {
    method: 'POST',
  });
};

/* ==========================================================================
   SUBJECTS, LABORATORIES & EXPERIMENTS API
   ========================================================================== */
export interface SubjectDto {
  _id: string;
  name: string;
  code: string;
  departmentId: string;
  courseId: string;
  semester?: number;
  credits?: number;
  status: string;
}

export interface LaboratoryDto {
  _id: string;
  name: string;
  code: string;
  courseId: string | { _id: string; name: string; code: string };
  departmentId: string | { _id: string; name: string; code: string };
  subjectId?: string;
  location?: string;
  capacity?: number;
  status: string;
}

export interface ProcedureStepDto {
  stepNumber: number;
  title: string;
  instruction?: string;
  instructions?: string;
  expectedObservation?: string;
  expectedOutcome?: string;
  safetyCheckRequired?: boolean;
}

export interface ExperimentDto {
  _id: string;
  title: string;
  code: string;
  description?: string;
  laboratoryId: string;
  departmentId?: string;
  courseId?: string;
  subjectId?: string;
  objectives?: string[];
  equipment?: string[];
  prerequisites?: string[];
  safetyInstructions?: string[];
  procedureSteps: ProcedureStepDto[];
  estimatedDurationMins?: number;
  status: 'draft' | 'under_review' | 'published' | 'archived';
}

export const getSubjects = async (query?: { courseId?: string }) => {
  const params = new URLSearchParams();
  if (query?.courseId) params.set('courseId', query.courseId);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return request<SubjectDto[]>(`/subjects${qStr}`);
};

export const createSubject = async (payload: {
  departmentId: string;
  courseId: string;
  name: string;
  code: string;
  semester?: number;
  credits?: number;
}) => {
  return request<SubjectDto>('/subjects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateSubject = async (id: string, payload: Partial<SubjectDto>) => {
  return request<SubjectDto>(`/subjects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const deleteSubject = async (id: string) => {
  return request<{ message: string }>(`/subjects/${id}`, {
    method: 'DELETE',
  });
};

export const deleteSubjectPermanently = async (id: string) => {
  return request<{ deletedId: string; message: string }>(`/subjects/${id}/permanent`, {
    method: 'DELETE',
  });
};

export const getLaboratories = async (query?: { courseId?: string; subjectId?: string; departmentId?: string }) => {
  const params = new URLSearchParams();
  if (query?.courseId) params.set('courseId', query.courseId);
  if (query?.subjectId) params.set('subjectId', query.subjectId);
  if (query?.departmentId) params.set('departmentId', query.departmentId);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return request<LaboratoryDto[]>(`/laboratories${qStr}`);
};

export const createLaboratory = async (payload: {
  departmentId: string;
  courseId: string;
  subjectId?: string;
  name: string;
  code: string;
  location?: string;
  capacity?: number;
}) => {
  return request<LaboratoryDto>('/laboratories', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateLaboratory = async (id: string, payload: Partial<LaboratoryDto>) => {
  return request<LaboratoryDto>(`/laboratories/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const deleteLaboratory = async (id: string) => {
  return request<{ message: string }>(`/laboratories/${id}`, {
    method: 'DELETE',
  });
};

export const deleteLaboratoryPermanently = async (id: string) => {
  return request<{ deletedId: string; message: string }>(`/laboratories/${id}/permanent`, {
    method: 'DELETE',
  });
};

export const getExperiments = async (query?: { laboratoryId?: string; subjectId?: string; status?: string }) => {
  const params = new URLSearchParams();
  if (query?.laboratoryId) params.set('laboratoryId', query.laboratoryId);
  if (query?.subjectId) params.set('subjectId', query.subjectId);
  if (query?.status) params.set('status', query.status);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return request<ExperimentDto[]>(`/experiments${qStr}`);
};

export const getExperimentById = async (id: string) => {
  return request<ExperimentDto>(`/experiments/${id}`);
};

export const createExperiment = async (payload: Partial<ExperimentDto>) => {
  return request<ExperimentDto>('/experiments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateExperiment = async (id: string, payload: Partial<ExperimentDto>) => {
  return request<ExperimentDto>(`/experiments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const publishExperiment = async (id: string) => {
  return request<ExperimentDto>(`/experiments/${id}/publish`, {
    method: 'POST',
  });
};

export const deleteExperiment = async (id: string) => {
  return request<{ message: string }>(`/experiments/${id}`, {
    method: 'DELETE',
  });
};

export const deleteExperimentPermanently = async (id: string) => {
  return request<{ deletedId: string; message: string }>(`/experiments/${id}/permanent`, {
    method: 'DELETE',
  });
};

/* ==========================================================================
   ASSESSMENTS & DIAGNOSTICS API
   ========================================================================== */
export interface AssessmentOptionDto {
  optionId: string;
  text: string;
}

export interface AssessmentQuestionDto {
  questionId: string;
  topicTag: string;
  prompt: string;
  options: AssessmentOptionDto[];
  correctOptionId: string;
  explanation?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  weight: number;
  sourceType?: 'ai_generated' | 'faculty_created';
  status?: 'draft' | 'approved' | 'rejected';
  sourceDocumentId?: string;
  sourceDocumentTitle?: string;
  sourceChunkIndex?: number;
  sourcePassage?: string;
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AssessmentDto {
  _id: string;
  experimentId: string;
  title: string;
  description?: string;
  type: 'initial_diagnostic' | 'final_summative';
  passingScorePercent: number;
  timeLimitMins: number;
  questions: AssessmentQuestionDto[];
  status: string;
  version?: number;
}

export interface TopicEvidenceDto {
  topicTag: string;
  questionsTotal?: number;
  questionsAttempted?: number;
  questionsCorrect: number;
  calculatedScore?: number;
  proficiencyScore?: number;
}

export interface AssessmentAttemptDto {
  _id: string;
  studentId: string;
  experimentId: string;
  type: string;
  attemptNumber: number;
  status: string;
  scorePercent: number;
  totalScore: number;
  maxScore: number;
  topicEvidence?: TopicEvidenceDto[];
  topicProficiencyEvidence?: TopicEvidenceDto[];
  prerequisiteGaps: string[];
  diagnosisExplanation: string;
  recommendedPath: string;
  facultySupportRecommended: boolean;
  determinedLearningLevel: 'beginner' | 'intermediate' | 'advanced';
  submittedAt: string;
}

export const getAssessmentForExperiment = async (experimentId: string, type: string = 'initial_diagnostic') => {
  return request<AssessmentDto>(`/assessments/experiment/${experimentId}?type=${type}`);
};

export const getAssessmentById = async (id: string) => {
  return request<AssessmentDto>(`/assessments/${id}`);
};

export const createAssessment = async (payload: {
  experimentId: string;
  type: string;
  title: string;
  description?: string;
  passingScorePercent?: number;
  timeLimitMins?: number;
  questions?: AssessmentQuestionDto[];
  status?: string;
}) => {
  return request<AssessmentDto>('/assessments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const addAssessmentQuestion = async (
  assessmentId: string,
  payload: {
    prompt: string;
    topicTag: string;
    options: AssessmentOptionDto[];
    correctOptionId: string;
    explanation?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    weight?: number;
  }
) => {
  return request<AssessmentDto>(`/assessments/${assessmentId}/questions`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateAssessmentQuestion = async (
  assessmentId: string,
  questionId: string,
  payload: {
    prompt?: string;
    topicTag?: string;
    options?: AssessmentOptionDto[];
    correctOptionId?: string;
    explanation?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    weight?: number;
  }
) => {
  return request<AssessmentDto>(`/assessments/${assessmentId}/questions/${questionId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
};

export const deleteAssessmentQuestion = async (assessmentId: string, questionId: string) => {
  return request<AssessmentDto>(`/assessments/${assessmentId}/questions/${questionId}`, {
    method: 'DELETE',
  });
};

export const updateAssessmentQuestionStatus = async (
  assessmentId: string,
  questionId: string,
  status: 'draft' | 'approved' | 'rejected'
) => {
  return request<{ assessment: AssessmentDto; question: AssessmentQuestionDto }>(
    `/assessments/${assessmentId}/questions/${questionId}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
};

export const approveAllDraftQuestions = async (assessmentId: string) => {
  return request<AssessmentDto>(`/assessments/${assessmentId}/questions/approve-all`, {
    method: 'POST',
  });
};

export const generateQuestionsFromResource = async (payload: {
  resourceId: string;
  experimentId: string;
  type?: 'initial_diagnostic' | 'final_summative';
  count?: number;
  difficulty?: 'all' | 'beginner' | 'intermediate' | 'advanced';
  topicFocus?: string;
}) => {
  return request<{
    assessment: AssessmentDto;
    generatedQuestions: AssessmentQuestionDto[];
    resource: { _id: string; title: string; chunkCount: number };
  }>('/assessments/generate-from-resource', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const submitAssessmentAttempt = async (
  assessmentId: string,
  payload: {
    answers: { questionId: string; selectedOptionId: string }[];
    durationSeconds: number;
    subjectId?: string;
    courseId?: string;
  }
) => {
  return request<AssessmentAttemptDto>(`/assessments/${assessmentId}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const getAssessmentAttemptById = async (attemptId: string) => {
  return request<AssessmentAttemptDto>(`/assessments/attempts/${attemptId}`);
};

export const updateAssessment = async (
  id: string,
  payload: {
    title?: string;
    description?: string;
    passingScorePercent?: number;
    timeLimitMins?: number;
    status?: string;
    questions?: AssessmentQuestionDto[];
  }
) => {
  return request<AssessmentDto>(`/assessments/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export const deleteAssessment = async (id: string) => {
  return request<{ message: string }>(`/assessments/${id}`, {
    method: 'DELETE',
  });
};

export const deleteAssessmentPermanently = async (id: string) => {
  return request<{ deletedId: string; message: string }>(`/assessments/${id}/permanent`, {
    method: 'DELETE',
  });
};

/* ==========================================================================
   LEARNING SESSIONS & SCAFFOLDING API
   ========================================================================== */
export interface StepProgressDto {
  stepNumber: number;
  title: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  startedAt?: string;
  completedAt?: string;
  observationRecorded?: string;
  verificationPassed?: boolean;
}

export interface ScaffoldingGuidelinesDto {
  tier: string;
  guidance: string;
  scaffoldingRules: string[];
  hintAssistanceLevel: string;
  understandingCheckFrequency: string;
  recommendedNextAction: string;
}

export interface LearningSessionDto {
  _id: string;
  studentId: string;
  experimentId: string;
  laboratoryId: string;
  sessionStatus: 'in_progress' | 'completed' | 'paused';
  assignedScaffoldingLevel: 'beginner' | 'intermediate' | 'advanced';
  currentStepNumber: number;
  stepProgress: StepProgressDto[];
  telemetry: {
    totalDurationSeconds: number;
    aiQueriesCount: number;
    escalationsCount: number;
    errorsEncounteredCount: number;
  };
}

export interface SessionResponseDto {
  session: LearningSessionDto;
  experiment: ExperimentDto;
  scaffolding: ScaffoldingGuidelinesDto;
}

export const getOrCreateSession = async (experimentId: string) => {
  return request<SessionResponseDto>(`/sessions/experiment/${experimentId}`);
};

export const updateSessionStep = async (
  sessionId: string,
  payload: {
    stepNumber: number;
    status: string;
    observationRecorded?: string;
    verificationPassed?: boolean;
    durationSeconds?: number;
  }
) => {
  return request<LearningSessionDto>(`/sessions/${sessionId}/step`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

export interface TutorResponseDto {
  answer: string;
  level: string;
  stepNumber: number;
  sourcedReferences: { resourceId: string; title: string; type: string; source: string }[];
  safetyNotice: string;
}

export const queryLabTutor = async (
  sessionId: string,
  payload: { studentQuery: string; stepNumber: number }
) => {
  return request<TutorResponseDto>(`/sessions/${sessionId}/tutor`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const getStudentProgress = async (studentId?: string) => {
  const endpoint = studentId ? `/sessions/progress/${studentId}` : '/sessions/progress';
  return request<{
    studentId: string;
    profile: any;
    sessions: any[];
    attempts: any[];
  }>(endpoint);
};

/* ==========================================================================
   HELP REQUESTS API
   ========================================================================== */
export interface HelpRequestDto {
  _id: string;
  studentId: string;
  studentName: string;
  experimentId: string;
  experimentTitle: string;
  learningSessionId?: string;
  assignedFacultyUserId?: { _id: string; name: string; email: string };
  stepNumber: number;
  studentQuery: string;
  escalationReason: string;
  status: 'pending_review' | 'in_review' | 'responded' | 'resolved';
  resolution?: {
    facultyResponse?: string;
    resolvedByUserId?: string;
    resolvedAt?: string;
  };
  createdAt: string;
}

export const listHelpRequests = async (query?: { status?: string; experimentId?: string }) => {
  const params = new URLSearchParams();
  if (query?.status && query.status !== 'all') params.set('status', query.status);
  if (query?.experimentId) params.set('experimentId', query.experimentId);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return request<HelpRequestDto[]>(`/help-requests${qStr}`);
};

export const createHelpRequest = async (payload: {
  experimentId: string;
  learningSessionId?: string;
  stepNumber: number;
  studentQuery: string;
  escalationReason?: string;
}) => {
  return request<HelpRequestDto>('/help-requests', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateHelpRequest = async (
  id: string,
  payload: { status?: string; facultyResponse?: string }
) => {
  return request<HelpRequestDto>(`/help-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

/* ==========================================================================
   LEARNING RESOURCES API
   ========================================================================== */
export interface LearningResourceDto {
  _id: string;
  title: string;
  description?: string;
  category: string;
  format: string;
  originalFilename: string;
  fileSizeBytes: number;
  ragIndexingStatus: 'pending' | 'indexing' | 'ready' | 'failed';
  processingFailureReason?: string;
  ragMetadata?: {
    chunkCount: number;
    indexedAt?: string;
    embeddingModel?: string;
  };
  departmentId?: { _id: string; name: string; code: string } | null;
  courseId?: { _id: string; name: string; code: string } | null;
  laboratoryId?: { _id: string; name: string; code: string } | null;
  uploadedByUserId?: { _id: string; name: string; email: string; role: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const listLearningResources = async (query?: { category?: string; departmentId?: string }) => {
  const params = new URLSearchParams();
  if (query?.category && query.category !== 'all') params.set('category', query.category);
  if (query?.departmentId && query.departmentId !== 'all') params.set('departmentId', query.departmentId);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return request<LearningResourceDto[]>(`/learning-resources${qStr}`);
};

export const uploadLearningResource = async (formData: FormData) => {
  return request<LearningResourceDto>('/learning-resources', {
    method: 'POST',
    body: formData,
  });
};

export const deleteLearningResource = async (resourceId: string) => {
  return request<{ deleted: boolean }>(`/learning-resources/${resourceId}`, {
    method: 'DELETE',
  });
};

export const getLearningResourceDownloadUrl = (resourceId: string) => {
  return `${API_BASE}/learning-resources/${resourceId}/download`;
};

export const downloadLearningResource = async (resourceId: string): Promise<Blob> => {
  const res = await fetch(`${API_BASE}/learning-resources/${resourceId}/download`, {
    credentials: 'include',
  });
  if (!res.ok) {
    throw new Error('Failed to download document');
  }
  return res.blob();
};

export const reindexLearningResource = async (resourceId: string) => {
  return request<LearningResourceDto>(`/learning-resources/${resourceId}/reindex`, {
    method: 'POST',
  });
};

/* ==========================================================================
   SUPPORT TICKETS API
   ========================================================================== */
export interface SupportTicketDto {
  _id: string;
  ticketNumber: string;
  subject: string;
  description: string;
  departmentId?: { _id: string; name: string; code: string } | null;
  submittedByUserId?: { _id: string; name: string; email: string; role: string } | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  resolutionNotes?: string;
  resolvedAt?: string;
  resolvedByUserId?: { _id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const listSupportTickets = async (query?: { status?: string; priority?: string; departmentId?: string }) => {
  const params = new URLSearchParams();
  if (query?.status && query.status !== 'all') params.set('status', query.status);
  if (query?.priority && query.priority !== 'all') params.set('priority', query.priority);
  if (query?.departmentId && query.departmentId !== 'all') params.set('departmentId', query.departmentId);
  const qStr = params.toString() ? `?${params.toString()}` : '';
  return request<SupportTicketDto[]>(`/support-tickets${qStr}`);
};

export const createSupportTicket = async (payload: {
  subject: string;
  description: string;
  departmentId?: string;
  priority?: string;
}) => {
  return request<SupportTicketDto>('/support-tickets', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};

export const updateSupportTicketStatus = async (
  ticketId: string,
  payload: { status: string; resolutionNotes?: string }
) => {
  return request<SupportTicketDto>(`/support-tickets/${ticketId}/status`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
};

/* ==========================================================================
   COLLEGE ANALYTICS & OVERSIGHT API
   ========================================================================== */
export interface CollegeAnalyticsDto {
  scheduledSessions: number;
  completedSessions: number;
  activeStudents: number;
  departmentsCount: number;
  laboratoriesCount: number;
  learningResourcesCount: number;
  completionRatePercent: number | null;
  aiInvocations: number;
  departmentalEngagement: Array<{
    departmentId: string;
    name: string;
    code: string;
    labsCount: number;
    studentsCount: number;
  }>;
}

export const getCollegeAnalytics = async () => {
  return request<CollegeAnalyticsDto>('/analytics/college/analytics');
};

export interface CollegeOverviewDepartment {
  id: string;
  name: string;
  code: string;
  status: string;
  labsCount: number;
  experimentsCount: number;
  studentsCount: number;
}

export interface CollegeOverviewDto {
  departmentsCount: number;
  laboratoriesCount: number;
  enrolledStudentsCount: number;
  approvedManualsCount: number;
  departments: CollegeOverviewDepartment[];
}

export const getCollegeOverview = async () => {
  return request<CollegeOverviewDto>('/analytics/college/overview');
};

export interface StudentInterventionDto {
  id: string;
  studentName: string;
  studentId: string;
  department: string;
  currentExperiment: string;
  flagReason: string;
  severity: 'high' | 'medium' | 'low';
  assignedFaculty: string;
  status: 'pending_intervention' | 'reviewed';
}

export const getStudentInterventions = async () => {
  return request<StudentInterventionDto[]>('/analytics/college/interventions');
};

export interface FacultyOversightDto {
  id: string;
  name: string;
  email: string;
  dept: string;
  role: string;
  authoredLabs: number;
  approvedDocs: number;
  escalationsAnswered: number;
  avgResponseTime: string;
}

export const getFacultyOversight = async () => {
  return request<FacultyOversightDto[]>('/analytics/college/faculty-oversight');
};

/* ==========================================================================
   FACULTY WORKBENCH & ANALYTICS API
   ========================================================================== */
export interface FacultyDashboardExperimentDto {
  id: string;
  title: string;
  code: string;
  labName: string;
  labCode: string;
  diagnosticQuiz: {
    configured: boolean;
    questionCount: number;
    status: string;
  };
  safetyProtocol: {
    hasSafetyRules: boolean;
    safetyNoticeCount: number;
  };
  activeLearners: number;
  stepCount: number;
  equipmentCount: number;
}

export interface FacultyDashboardEscalationDto {
  id: string;
  studentName: string;
  experimentTitle: string;
  stepNumber: number;
  escalationReason: string;
  studentQuery: string;
  createdAt: string;
}

export interface FacultyDashboardDto {
  hasAssignment: boolean;
  faculty: {
    id: string;
    name: string;
    email: string;
    department?: string;
    departmentCode?: string;
    course?: string;
    courseCode?: string;
  };
  metrics: {
    assignedLabsCount: number;
    activeExperimentsCount: number;
    totalExperimentsCount: number;
    enrolledStudentsCount: number;
    pendingEscalationsCount: number;
  };
  experiments: FacultyDashboardExperimentDto[];
  pendingEscalations: FacultyDashboardEscalationDto[];
}

export const getFacultyDashboard = async () => {
  return request<FacultyDashboardDto>('/analytics/faculty/dashboard');
};

export interface FacultyAnalyticsDto {
  hasAttempts: boolean;
  diagnosticAvg: number | null;
  summativeAvg: number | null;
  avgDurationMins: number | null;
  learningResourcesCount: number;
  totalDiagnosticAttempts: number;
  totalSummativeAttempts: number;
  stepMatrix: {
    step: string;
    avgScore: number;
    attemptsCount: number;
  }[];
}

export const getFacultyAnalytics = async () => {
  return request<FacultyAnalyticsDto>('/analytics/faculty/analytics');
};

export interface FacultyLearningGapDto {
  topic: string;
  errorCount: number;
  severity: 'high' | 'medium';
  affectedStudents: number;
  rootCause: string;
  remedy: string;
}

export const getFacultyLearningGaps = async () => {
  return request<FacultyLearningGapDto[]>('/analytics/faculty/learning-gaps');
};



