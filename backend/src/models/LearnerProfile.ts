import mongoose, { Schema, Document, Model } from 'mongoose';

export type LearningLevel = 'beginner' | 'intermediate' | 'advanced';
export type EvidenceSourceType =
  | 'initial_diagnostic'
  | 'final_summative'
  | 'step_telemetry'
  | 'faculty_override';

export type LearnerStatus = 'active' | 'graduated' | 'suspended';

export interface ITopicProficiency {
  topicTag: string;
  experimentId?: mongoose.Types.ObjectId;
  currentLevel: LearningLevel;
  confidenceScore: number; // 0.0 to 1.0
  evidenceSource: EvidenceSourceType;
  assessmentAttemptId?: mongoose.Types.ObjectId;
  assessedAt: Date;
  notes?: string;
}

export interface ITelemetrySummary {
  totalExperimentsCompleted: number;
  totalLabHours: number;
  totalHelpRequests: number;
  lastActiveAt?: Date;
}

export interface ILearnerProfile extends Document {
  _id: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  enrolledCourseIds: mongoose.Types.ObjectId[];
  topicProficiencies: ITopicProficiency[];
  telemetrySummary: ITelemetrySummary;
  status: LearnerStatus;
  createdAt: Date;
  updatedAt: Date;
}

const topicProficiencySchema = new Schema<ITopicProficiency>(
  {
    topicTag: {
      type: String,
      required: [true, 'Topic tag is required for evidence-based proficiency tracking'],
      trim: true,
    },
    experimentId: {
      type: Schema.Types.ObjectId,
      ref: 'Experiment',
    },
    currentLevel: {
      type: String,
      enum: {
        values: ['beginner', 'intermediate', 'advanced'],
        message: 'Invalid learning level: {VALUE}',
      },
      required: true,
    },
    confidenceScore: {
      type: Number,
      required: true,
      min: [0.0, 'Confidence score cannot be less than 0.0'],
      max: [1.0, 'Confidence score cannot exceed 1.0'],
      default: 0.5,
    },
    evidenceSource: {
      type: String,
      enum: {
        values: ['initial_diagnostic', 'final_summative', 'step_telemetry', 'faculty_override'],
        message: 'Invalid evidence source: {VALUE}',
      },
      required: true,
    },
    assessmentAttemptId: {
      type: Schema.Types.ObjectId,
      ref: 'AssessmentAttempt',
    },
    assessedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: [500, 'Notes cannot exceed 500 characters'],
    },
  },
  { _id: false }
);

const telemetrySummarySchema = new Schema<ITelemetrySummary>(
  {
    totalExperimentsCompleted: { type: Number, default: 0, min: 0 },
    totalLabHours: { type: Number, default: 0, min: 0 },
    totalHelpRequests: { type: Number, default: 0, min: 0 },
    lastActiveAt: { type: Date },
  },
  { _id: false }
);

export const learnerProfileSchema = new Schema<ILearnerProfile>(
  {
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student user reference (studentId) is required'],
      index: true,
    },
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institutional tenancy (institutionId) is required'],
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    enrolledCourseIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
    topicProficiencies: {
      type: [topicProficiencySchema],
      default: [],
    },
    telemetrySummary: {
      type: telemetrySummarySchema,
      default: () => ({
        totalExperimentsCompleted: 0,
        totalLabHours: 0,
        totalHelpRequests: 0,
      }),
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'graduated', 'suspended'],
        message: 'Invalid learner status: {VALUE}',
      },
      default: 'active',
      required: true,
      index: true,
    },
  },
  {
    collection: 'learner_profiles',
    timestamps: true,
  }
);

// One learner profile per student per institution
learnerProfileSchema.index({ institutionId: 1, studentId: 1 }, { unique: true });

export const LearnerProfile: Model<ILearnerProfile> =
  (mongoose.models['LearnerProfile'] as Model<ILearnerProfile>) ||
  mongoose.model<ILearnerProfile>('LearnerProfile', learnerProfileSchema);
