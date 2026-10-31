import mongoose, { Schema, Document, Model } from 'mongoose';
import { AssessmentType } from './Assessment';
import { LearningLevel } from './LearnerProfile';

export type AttemptStatus = 'in_progress' | 'completed' | 'timed_out' | 'abandoned';

export interface IAttemptAnswer {
  questionId: string;
  topicTag: string;
  selectedOptionId: string;
  isCorrect: boolean;
  timeSpentSeconds: number;
}

export interface ITopicEvidence {
  topicTag: string;
  questionsTotal: number;
  questionsCorrect: number;
  calculatedScore: number; // percentage 0 - 100
}

export interface IAssessmentAttempt extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  assessmentId: mongoose.Types.ObjectId;
  experimentId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  attemptNumber: number;
  type: AssessmentType;
  startedAt: Date;
  submittedAt?: Date;
  durationSeconds: number;
  answers: IAttemptAnswer[];
  totalScore?: number;
  maxScore?: number;
  scorePercent: number;
  passed: boolean;
  determinedLearningLevel?: LearningLevel;
  topicProficiencyEvidence: ITopicEvidence[];
  prerequisiteGaps?: string[];
  diagnosisExplanation?: string;
  recommendedPath?: string;
  facultySupportRecommended?: boolean;
  status: AttemptStatus;
  createdAt: Date;
  updatedAt: Date;
}

const attemptAnswerSchema = new Schema<IAttemptAnswer>(
  {
    questionId: { type: String, required: true, trim: true },
    topicTag: { type: String, required: true, trim: true },
    selectedOptionId: { type: String, required: true, trim: true },
    isCorrect: { type: Boolean, required: true },
    timeSpentSeconds: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

const topicEvidenceSchema = new Schema<ITopicEvidence>(
  {
    topicTag: { type: String, required: true, trim: true },
    questionsTotal: { type: Number, required: true, min: 0 },
    questionsCorrect: { type: Number, required: true, min: 0 },
    calculatedScore: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

export const assessmentAttemptSchema = new Schema<IAssessmentAttempt>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institutional tenancy (institutionId) is required'],
      index: true,
    },
    assessmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Assessment',
      required: [true, 'Assessment reference (assessmentId) is required'],
      index: true,
    },
    experimentId: {
      type: Schema.Types.ObjectId,
      ref: 'Experiment',
      required: [true, 'Experiment reference (experimentId) is required'],
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student user reference (studentId) is required'],
      index: true,
    },
    attemptNumber: {
      type: Number,
      required: [true, 'Attempt number is required'],
      min: [1, 'Attempt number must be >= 1'],
      default: 1,
    },
    type: {
      type: String,
      enum: {
        values: ['initial_diagnostic', 'final_summative'],
        message: 'Invalid assessment type: {VALUE}',
      },
      required: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    submittedAt: {
      type: Date,
    },
    durationSeconds: {
      type: Number,
      default: 0,
      min: 0,
    },
    answers: {
      type: [attemptAnswerSchema],
      default: [],
    },
    totalScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxScore: {
      type: Number,
      default: 0,
      min: 0,
    },
    scorePercent: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    determinedLearningLevel: {
      type: String,
      enum: {
        values: ['beginner', 'intermediate', 'advanced'],
        message: 'Invalid learning level: {VALUE}',
      },
    },
    topicProficiencyEvidence: {
      type: [topicEvidenceSchema],
      default: [],
    },
    prerequisiteGaps: {
      type: [String],
      default: [],
    },
    diagnosisExplanation: {
      type: String,
      trim: true,
      maxlength: 2000,
    },
    recommendedPath: {
      type: String,
      trim: true,
    },
    facultySupportRecommended: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: {
        values: ['in_progress', 'completed', 'timed_out', 'abandoned'],
        message: 'Invalid attempt status: {VALUE}',
      },
      default: 'in_progress',
      required: true,
      index: true,
    },
  },
  {
    collection: 'assessment_attempts',
    timestamps: true,
  }
);

// Compound Indexes for auditability and fast student attempt lookups
assessmentAttemptSchema.index(
  { institutionId: 1, studentId: 1, experimentId: 1, attemptNumber: 1 },
  { unique: true }
);
assessmentAttemptSchema.index({ assessmentId: 1, status: 1 });
assessmentAttemptSchema.index({ studentId: 1, status: 1 });

export const AssessmentAttempt: Model<IAssessmentAttempt> =
  (mongoose.models['AssessmentAttempt'] as Model<IAssessmentAttempt>) ||
  mongoose.model<IAssessmentAttempt>('AssessmentAttempt', assessmentAttemptSchema);
