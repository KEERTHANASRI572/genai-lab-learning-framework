import mongoose, { Schema, Document, Model } from 'mongoose';

export type AssessmentType = 'initial_diagnostic' | 'final_summative';
export type QuestionDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type AssessmentStatus = 'draft' | 'published' | 'archived';

export type QuestionSourceType = 'ai_generated' | 'faculty_created';
export type QuestionApprovalStatus = 'draft' | 'approved' | 'rejected';

export interface IAssessmentOption {
  optionId: string;
  text: string;
}

export interface IAssessmentQuestion {
  questionId: string;
  topicTag: string;
  prompt: string;
  options: IAssessmentOption[];
  correctOptionId: string;
  explanation?: string;
  difficulty: QuestionDifficulty;
  weight: number;
  sourceType?: QuestionSourceType;
  status?: QuestionApprovalStatus;
  sourceDocumentId?: mongoose.Types.ObjectId;
  sourceDocumentTitle?: string;
  sourceChunkIndex?: number;
  sourcePassage?: string;
  authorFacultyUserId?: mongoose.Types.ObjectId;
  isArchived?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IAssessment extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  experimentId: mongoose.Types.ObjectId;
  type: AssessmentType;
  title: string;
  description?: string;
  passingScorePercent: number;
  timeLimitMins: number;
  questions: IAssessmentQuestion[];
  status: AssessmentStatus;
  version: number;
  authorFacultyUserId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const assessmentOptionSchema = new Schema<IAssessmentOption>(
  {
    optionId: {
      type: String,
      required: [true, 'Option identifier is required'],
      trim: true,
    },
    text: {
      type: String,
      required: [true, 'Option text is required'],
      trim: true,
      maxlength: [1000, 'Option text cannot exceed 1000 characters'],
    },
  },
  { _id: false }
);

const assessmentQuestionSchema = new Schema<IAssessmentQuestion>(
  {
    questionId: {
      type: String,
      required: [true, 'Question identifier is required'],
      trim: true,
    },
    topicTag: {
      type: String,
      required: [true, 'Topic tag is required for evidence mapping'],
      trim: true,
      maxlength: [100, 'Topic tag cannot exceed 100 characters'],
    },
    prompt: {
      type: String,
      required: [true, 'Question prompt is required'],
      trim: true,
      maxlength: [2000, 'Prompt cannot exceed 2000 characters'],
    },
    options: {
      type: [assessmentOptionSchema],
      validate: [
        (opts: IAssessmentOption[]) => opts.length >= 2,
        'Question must have at least 2 selectable options',
      ],
      required: true,
    },
    correctOptionId: {
      type: String,
      required: [true, 'Correct option identifier is required'],
      trim: true,
    },
    explanation: {
      type: String,
      trim: true,
      maxlength: [2000, 'Explanation cannot exceed 2000 characters'],
    },
    difficulty: {
      type: String,
      enum: {
        values: ['beginner', 'intermediate', 'advanced'],
        message: 'Invalid question difficulty: {VALUE}',
      },
      default: 'intermediate',
      required: true,
    },
    weight: {
      type: Number,
      default: 1,
      min: [1, 'Question weight must be at least 1'],
    },
    sourceType: {
      type: String,
      enum: ['ai_generated', 'faculty_created'],
      default: 'faculty_created',
      required: true,
    },
    status: {
      type: String,
      enum: ['draft', 'approved', 'rejected'],
      default: 'approved',
      required: true,
    },
    sourceDocumentId: {
      type: Schema.Types.ObjectId,
      ref: 'LearningResource',
    },
    sourceDocumentTitle: {
      type: String,
      trim: true,
    },
    sourceChunkIndex: {
      type: Number,
    },
    sourcePassage: {
      type: String,
      trim: true,
      maxlength: [3000, 'Source passage cannot exceed 3000 characters'],
    },
    authorFacultyUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    isArchived: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

export const assessmentSchema = new Schema<IAssessment>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institutional tenancy (institutionId) is required'],
      index: true,
    },
    experimentId: {
      type: Schema.Types.ObjectId,
      ref: 'Experiment',
      required: [true, 'Experiment reference (experimentId) is required'],
      index: true,
    },
    type: {
      type: String,
      enum: {
        values: ['initial_diagnostic', 'final_summative'],
        message: 'Invalid assessment type: {VALUE}',
      },
      required: [true, 'Assessment type is required'],
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Assessment title is required'],
      trim: true,
      minlength: [2, 'Title must be at least 2 characters'],
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    passingScorePercent: {
      type: Number,
      min: [0, 'Passing score cannot be negative'],
      max: [100, 'Passing score cannot exceed 100'],
      default: 60,
    },
    timeLimitMins: {
      type: Number,
      min: [1, 'Time limit must be at least 1 minute'],
      max: [180, 'Time limit cannot exceed 180 minutes'],
      default: 20,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    questions: {
      type: [assessmentQuestionSchema],
      default: [],
    },
    status: {
      type: String,
      enum: {
        values: ['draft', 'published', 'archived'],
        message: 'Invalid assessment status: {VALUE}',
      },
      default: 'draft',
      required: true,
      index: true,
    },
    authorFacultyUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author faculty reference is required'],
      index: true,
    },
  },
  {
    collection: 'assessments',
    timestamps: true,
  }
);

// Compound Unique Index: One diagnostic and one summative assessment config per experiment
assessmentSchema.index({ experimentId: 1, type: 1 }, { unique: true });
assessmentSchema.index({ institutionId: 1, status: 1 });

export const Assessment: Model<IAssessment> =
  (mongoose.models['Assessment'] as Model<IAssessment>) ||
  mongoose.model<IAssessment>('Assessment', assessmentSchema);
