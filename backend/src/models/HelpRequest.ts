import mongoose, { Schema, Document, Model } from 'mongoose';

export type HelpEscalationReason =
  | 'repeated_error'
  | 'student_requested'
  | 'safety_boundary'
  | 'complex_query';

export type HelpRequestStatus =
  | 'pending_review'
  | 'in_progress'
  | 'responded'
  | 'resolved';

export interface IHelpResolution {
  facultyResponse?: string;
  resolvedByUserId?: mongoose.Types.ObjectId;
  resolvedAt?: Date;
}

export interface IHelpRequest extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  studentName: string;
  experimentId: mongoose.Types.ObjectId;
  experimentTitle: string;
  learningSessionId?: mongoose.Types.ObjectId;
  assignedFacultyUserId?: mongoose.Types.ObjectId;
  stepNumber: number;
  studentQuery: string;
  aiSuggestedContext?: string;
  escalationReason: HelpEscalationReason;
  status: HelpRequestStatus;
  resolution?: IHelpResolution;
  createdAt: Date;
  updatedAt: Date;
}

const helpResolutionSchema = new Schema<IHelpResolution>(
  {
    facultyResponse: {
      type: String,
      trim: true,
      maxlength: [4000, 'Faculty response cannot exceed 4000 characters'],
    },
    resolvedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    resolvedAt: {
      type: Date,
    },
  },
  { _id: false }
);

export const helpRequestSchema = new Schema<IHelpRequest>(
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
    studentName: {
      type: String,
      required: [true, 'Student name is required'],
      trim: true,
    },
    experimentId: {
      type: Schema.Types.ObjectId,
      ref: 'Experiment',
      required: [true, 'Experiment reference (experimentId) is required'],
      index: true,
    },
    experimentTitle: {
      type: String,
      required: [true, 'Experiment title is required'],
      trim: true,
    },
    learningSessionId: {
      type: Schema.Types.ObjectId,
      ref: 'LearningSession',
      index: true,
    },
    assignedFacultyUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    stepNumber: {
      type: Number,
      required: [true, 'Step number is required'],
      min: [1, 'Step number must be >= 1'],
    },
    studentQuery: {
      type: String,
      required: [true, 'Student query description is required'],
      trim: true,
      minlength: [5, 'Student query must be at least 5 characters'],
      maxlength: [2000, 'Student query cannot exceed 2000 characters'],
    },
    aiSuggestedContext: {
      type: String,
      trim: true,
      maxlength: [4000, 'AI suggested context cannot exceed 4000 characters'],
    },
    escalationReason: {
      type: String,
      enum: {
        values: ['repeated_error', 'student_requested', 'safety_boundary', 'complex_query'],
        message: 'Invalid escalation reason: {VALUE}',
      },
      required: [true, 'Escalation reason is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['pending_review', 'in_progress', 'responded', 'resolved'],
        message: 'Invalid help request status: {VALUE}',
      },
      default: 'pending_review',
      required: true,
      index: true,
    },
    resolution: {
      type: helpResolutionSchema,
    },
  },
  {
    collection: 'help_requests',
    timestamps: true,
  }
);

// Indexes
helpRequestSchema.index({ institutionId: 1, status: 1 });
helpRequestSchema.index({ assignedFacultyUserId: 1, status: 1 });
helpRequestSchema.index({ experimentId: 1, status: 1 });

export const HelpRequest: Model<IHelpRequest> =
  (mongoose.models['HelpRequest'] as Model<IHelpRequest>) ||
  mongoose.model<IHelpRequest>('HelpRequest', helpRequestSchema);
