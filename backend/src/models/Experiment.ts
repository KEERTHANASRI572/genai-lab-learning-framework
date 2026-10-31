import mongoose, { Schema, Document, Model } from 'mongoose';

export type StepVerificationType =
  | 'observation_check'
  | 'numeric_tolerance'
  | 'code_execution'
  | 'manual_signoff';

export type ExperimentStatus = 'draft' | 'review_pending' | 'published' | 'archived';

export interface IProcedureStep {
  stepNumber: number;
  title: string;
  instruction: string;
  safetyWarning?: string;
  expectedObservation: string;
  requiredApparatus: string[];
  verificationType: StepVerificationType;
}

export interface IExperiment extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  laboratoryId: mongoose.Types.ObjectId;
  title: string;
  code: string;
  description?: string;
  objectives: string[];
  equipment: string[];
  prerequisites: string[];
  safetyInstructions: string[];
  procedureSteps: IProcedureStep[];
  approvedResourceIds: mongoose.Types.ObjectId[];
  estimatedDurationMins: number;
  authorFacultyUserId: mongoose.Types.ObjectId;
  topicTags: string[];
  status: ExperimentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const procedureStepSchema = new Schema<IProcedureStep>(
  {
    stepNumber: {
      type: Number,
      required: [true, 'Procedure step number is required'],
      min: [1, 'Step number must be >= 1'],
    },
    title: {
      type: String,
      required: [true, 'Step title is required'],
      trim: true,
      maxlength: [150, 'Step title cannot exceed 150 characters'],
    },
    instruction: {
      type: String,
      required: [true, 'Step instruction is required'],
      trim: true,
      maxlength: [4000, 'Step instruction cannot exceed 4000 characters'],
    },
    safetyWarning: {
      type: String,
      trim: true,
      maxlength: [1000, 'Safety warning cannot exceed 1000 characters'],
    },
    expectedObservation: {
      type: String,
      required: [true, 'Expected observation is required'],
      trim: true,
      maxlength: [2000, 'Expected observation cannot exceed 2000 characters'],
    },
    requiredApparatus: {
      type: [String],
      default: [],
    },
    verificationType: {
      type: String,
      enum: {
        values: ['observation_check', 'numeric_tolerance', 'code_execution', 'manual_signoff'],
        message: 'Invalid step verification type: {VALUE}',
      },
      default: 'observation_check',
      required: true,
    },
  },
  { _id: false }
);

export const experimentSchema = new Schema<IExperiment>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institutional tenancy (institutionId) is required'],
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      required: [true, 'Department reference (departmentId) is required'],
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      required: [true, 'Course reference (courseId) is required'],
      index: true,
    },
    subjectId: {
      type: Schema.Types.ObjectId,
      ref: 'Subject',
      required: false,
      index: true,
    },
    laboratoryId: {
      type: Schema.Types.ObjectId,
      ref: 'Laboratory',
      required: [true, 'Laboratory reference (laboratoryId) is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Experiment title is required'],
      trim: true,
      minlength: [3, 'Experiment title must be at least 3 characters'],
      maxlength: [250, 'Experiment title cannot exceed 250 characters'],
    },
    code: {
      type: String,
      required: [true, 'Experiment code is required'],
      trim: true,
      uppercase: true,
      minlength: [2, 'Experiment code must be at least 2 characters'],
      maxlength: [30, 'Experiment code cannot exceed 30 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [3000, 'Experiment description cannot exceed 3000 characters'],
    },
    objectives: {
      type: [String],
      default: [],
    },
    equipment: {
      type: [String],
      default: [],
    },
    prerequisites: {
      type: [String],
      default: [],
    },
    safetyInstructions: {
      type: [String],
      default: [],
    },
    procedureSteps: {
      type: [procedureStepSchema],
      default: [],
    },
    approvedResourceIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'LearningResource',
      },
    ],
    estimatedDurationMins: {
      type: Number,
      min: [5, 'Duration must be at least 5 minutes'],
      max: [600, 'Duration cannot exceed 600 minutes (10 hours)'],
      default: 90,
    },
    authorFacultyUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author faculty reference is required'],
      index: true,
    },
    topicTags: {
      type: [String],
      default: [],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'review_pending', 'published', 'archived'],
        message: 'Invalid experiment status: {VALUE}',
      },
      default: 'draft',
      required: true,
      index: true,
    },
  },
  {
    collection: 'experiments',
    timestamps: true,
  }
);

// Compound Unique Index: Experiment codes must be unique per laboratory in an institution
experimentSchema.index({ institutionId: 1, laboratoryId: 1, code: 1 }, { unique: true });
experimentSchema.index({ institutionId: 1, status: 1 });
experimentSchema.index({ laboratoryId: 1, status: 1 });

export const Experiment: Model<IExperiment> =
  (mongoose.models['Experiment'] as Model<IExperiment>) ||
  mongoose.model<IExperiment>('Experiment', experimentSchema);
