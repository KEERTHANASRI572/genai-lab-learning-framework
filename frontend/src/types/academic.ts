export type LearningLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Department {
  id: string;
  name: string;
  code: string;
  headOfDepartment: string;
  courseCount: number;
  laboratoryCount: number;
}

export interface Course {
  id: string;
  departmentId: string;
  name: string;
  code: string;
  degreeLevel: 'undergraduate' | 'postgraduate' | 'diploma';
  semester: number;
  subjectCount: number;
}

export interface Subject {
  id: string;
  courseId: string;
  name: string;
  code: string;
  facultyLead: string;
  laboratoryCount: number;
  enrolledStudentsCount: number;
}

export interface Laboratory {
  id: string;
  courseId: string;
  departmentId?: string;
  subjectId?: string;
  name: string;
  code: string;
  location: string;
  experimentCount: number;
  safetyProtocolRef: string;
}

export interface ProcedureStep {
  stepNumber: number;
  title: string;
  instruction: string;
  safetyWarning?: string;
  expectedObservation: string;
  requiredApparatus: string[];
}

export interface Experiment {
  id: string;
  laboratoryId: string;
  laboratoryName: string;
  subjectName: string;
  title: string;
  code: string;
  objectives: string[];
  equipment: string[];
  prerequisites: string[];
  safetyInstructions: string[];
  procedureSteps: ProcedureStep[];
  approvedResourceIds: string[];
  estimatedDurationMins: number;
}

export interface ApprovedResource {
  id: string;
  institutionId: string;
  title: string;
  category: 'manual' | 'schematic' | 'safety_datasheet' | 'lecture_note' | 'protocol';
  format: 'PDF' | 'DOCX' | 'VIDEO' | 'INTERACTIVE';
  fileSizeMb: number;
  ragIndexingStatus: 'ready' | 'indexing' | 'pending' | 'failed';
  uploadedBy: string;
  uploadedAt: string;
}

export interface AssessmentQuestion {
  id: string;
  topicTag: string;
  prompt: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface AssessmentConfig {
  id: string;
  experimentId: string;
  type: 'initial_diagnostic' | 'final_summative';
  title: string;
  questions: AssessmentQuestion[];
}

export interface LearnerTopicProficiency {
  topic: string;
  level: LearningLevel;
  confidenceScore: number;
  evidenceSource: string;
  lastAssessedAt: string;
}

export interface FacultyHelpRequest {
  id: string;
  studentName: string;
  experimentTitle: string;
  stepNumber: number;
  studentQuery: string;
  aiSuggestedContext?: string;
  escalationReason: 'repeated_error' | 'student_requested' | 'safety_boundary' | 'complex_query';
  status: 'pending_review' | 'responded';
  createdAt: string;
}
