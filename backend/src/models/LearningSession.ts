import mongoose, { Schema, Document, Model } from 'mongoose';
import { LearningLevel } from './LearnerProfile';

export type SessionStatus = 'in_progress' | 'paused' | 'completed' | 'terminated';
export type StepProgressStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export interface IStepProgress {
  stepNumber: number;
  title: string;
  status: StepProgressStatus;
  startedAt?: Date;
  completedAt?: Date;
  observationRecorded?: string;
  verificationPassed?: boolean;
}

export interface IAiSessionInteraction {
  timestamp: Date;
  stepNumber: number;
  queryPrompt: string;
  responseSummary?: string;
  citedResourceIds?: mongoose.Types.ObjectId[];
  facultyEscalated?: boolean;
}

export interface ISessionTelemetry {
  totalDurationSeconds: number;
  aiQueriesCount: number;
  escalationsCount: number;
  errorsEncounteredCount: number;
}

export interface ILearningSession extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  experimentId: mongoose.Types.ObjectId;
  laboratoryId?: mongoose.Types.ObjectId;
  sessionStatus: SessionStatus;
  startedAt: Date;
  endedAt?: Date;
  assignedScaffoldingLevel: LearningLevel;
  currentStepNumber: number;
  stepProgress: IStepProgress[];
  aiInteractions: IAiSessionInteraction[];
  telemetry: ISessionTelemetry;
  finalStudentObservations?: string;
  createdAt: Date;
  updatedAt: Date;
}

const stepProgressSchema = new Schema<IStepProgress>(
  {
    stepNumber: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: {
        values: ['pending', 'in_progress', 'completed', 'skipped'],
        message: 'Invalid step status: {VALUE}',
      },
      default: 'pending',
      required: true,
    },
    startedAt: { type: Date },
    completedAt: { type: Date },
    observationRecorded: { type: String, trim: true, maxlength: 4000 },
    verificationPassed: { type: Boolean },
  },
  { _id: false }
);

const aiSessionInteractionSchema = new Schema<IAiSessionInteraction>(
  {
    timestamp: { type: Date, default: Date.now, required: true },
    stepNumber: { type: Number, required: true, min: 1 },
    queryPrompt: { type: String, required: true, trim: true, maxlength: 2000 },
    responseSummary: { type: String, trim: true, maxlength: 4000 },
    citedResourceIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'LearningResource',
      },
    ],
    facultyEscalated: { type: Boolean, default: false },
  },
  { _id: false }
);

const sessionTelemetrySchema = new Schema<ISessionTelemetry>(
  {
    totalDurationSeconds: { type: Number, default: 0, min: 0 },
    aiQueriesCount: { type: Number, default: 0, min: 0 },
    escalationsCount: { type: Number, default: 0, min: 0 },
    errorsEncounteredCount: { type: Number, default: 0, min: 0 },
  },
  { _id: false }
);

export const learningSessionSchema = new Schema<ILearningSession>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institutional tenancy (institutionId) is required'],
      index: true,
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Student user reference (studentId) is required'],
      index: true,
    },
    experimentId: {
      type: Schema.Types.ObjectId,
      ref: 'Experiment',
      required: [true, 'Experiment reference (experimentId) is required'],
      index: true,
    },
    laboratoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Laboratory',
      index: true,
    },
    sessionStatus: {
      type: String,
      enum: {
        values: ['in_progress', 'paused', 'completed', 'terminated'],
        message: 'Invalid session status: {VALUE}',
      },
      default: 'in_progress',
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    endedAt: {
      type: Date,
    },
    assignedScaffoldingLevel: {
      type: String,
      enum: {
        values: ['beginner', 'intermediate', 'advanced'],
        message: 'Invalid scaffolding level: {VALUE}',
      },
      required: [true, 'Assigned scaffolding level is required'],
    },
    currentStepNumber: {
      type: Number,
      default: 1,
      min: [1, 'Step number must be >= 1'],
    },
    stepProgress: {
      type: [stepProgressSchema],
      default: [],
    },
    aiInteractions: {
      type: [aiSessionInteractionSchema],
      default: [],
    },
    telemetry: {
      type: sessionTelemetrySchema,
      default: () => ({
        totalDurationSeconds: 0,
        aiQueriesCount: 0,
        escalationsCount: 0,
        errorsEncounteredCount: 0,
      }),
    },
    finalStudentObservations: {
      type: String,
      trim: true,
      maxlength: [8000, 'Student observations cannot exceed 8000 characters'],
    },
  },
  {
    collection: 'learning_sessions',
    timestamps: true,
  }
);

// Indexes
learningSessionSchema.index({ institutionId: 1, studentId: 1, experimentId: 1, sessionStatus: 1 });
learningSessionSchema.index({ experimentId: 1, sessionStatus: 1 });
learningSessionSchema.index({ studentId: 1, createdAt: -1 });

export const LearningSession: Model<ILearningSession> =
  (mongoose.models['LearningSession'] as Model<ILearningSession>) ||
  mongoose.model<ILearningSession>('LearningSession', learningSessionSchema);
