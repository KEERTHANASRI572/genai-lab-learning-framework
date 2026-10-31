import mongoose, { Schema, Document, Model } from 'mongoose';

export type ResourceCategory =
  | 'manual'
  | 'schematic'
  | 'safety_datasheet'
  | 'lecture_note'
  | 'protocol';

export type ResourceFormat = 'PDF' | 'DOCX' | 'VIDEO' | 'INTERACTIVE' | 'markdown' | 'text';
export type RagIndexingStatus = 'pending' | 'indexing' | 'ready' | 'failed';
export type ResourceStatus = 'draft' | 'published' | 'archived';

// Approval workflow status for resources
export type ResourceApprovalStatus = 'pending_review' | 'approved' | 'rejected';

export interface IRagMetadata {
  chunkCount: number;
  embeddingModel?: string;
  vectorIndexCollection?: string;
  indexedAt?: Date;
  lastError?: string;
}

export interface ILearningResource extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  laboratoryId?: mongoose.Types.ObjectId;
  experimentId?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  category: ResourceCategory;
  format: ResourceFormat;
  storageKey: string;
  storageBucket: string;
  version?: number;
  mimeType: string;
  fileSizeBytes: number;
  checksumSha256?: string;
  ragIndexingStatus: RagIndexingStatus;
  ragMetadata: IRagMetadata;
  uploadedByUserId: mongoose.Types.ObjectId;
  status: ResourceStatus;
  approvalStatus: ResourceApprovalStatus;
  processingJobId?: string;
  processingFailureReason?: string;
  replacedByResourceId?: mongoose.Types.ObjectId;
  storageProvider?: string;
  createdAt: Date;
  updatedAt: Date;
  originalFilename: string;
}

const ragMetadataSchema = new Schema<IRagMetadata>(
  {
    chunkCount: { type: Number, default: 0, min: 0 },
    embeddingModel: { type: String, trim: true },
    vectorIndexCollection: { type: String, trim: true },
    indexedAt: { type: Date },
    lastError: { type: String, trim: true },
  },
  { _id: false }
);

export const learningResourceSchema = new Schema<ILearningResource>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institutional tenancy (institutionId) is required'],
      index: true,
    },
    departmentId: { type: Schema.Types.ObjectId, ref: 'Department', index: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', index: true },
    laboratoryId: { type: Schema.Types.ObjectId, ref: 'Laboratory', index: true },
    experimentId: { type: Schema.Types.ObjectId, ref: 'Experiment', index: true },
    title: { type: String, required: [true, 'Resource title is required'], trim: true, minlength: [2, 'Resource title must be at least 2 characters'], maxlength: [200, 'Resource title cannot exceed 200 characters'] },
    description: { type: String, trim: true, maxlength: [2000, 'Resource description cannot exceed 2000 characters'] },
    category: { type: String, enum: { values: ['manual', 'schematic', 'safety_datasheet', 'lecture_note', 'protocol'], message: 'Invalid resource category: {VALUE}' }, required: [true, 'Resource category is required'], index: true },
    format: { type: String, enum: { values: ['PDF', 'DOCX', 'VIDEO', 'INTERACTIVE'], message: 'Invalid resource format: {VALUE}' }, required: [true, 'Resource format is required'] },
    storageKey: { type: String, required: [true, 'Storage object reference key is required'], trim: true },
    storageBucket: { type: String, required: [true, 'Storage bucket reference is required'], trim: true, default: 'default-curriculum-bucket' },
    originalFilename: { type: String, required: [true, 'Original filename is required'], trim: true },
    mimeType: { type: String, required: [true, 'MIME type is required'], trim: true },
    fileSizeBytes: { type: Number, required: [true, 'File size in bytes is required'], min: [0, 'File size cannot be negative'] },
    checksumSha256: { type: String, trim: true },
    ragIndexingStatus: { type: String, enum: { values: ['pending', 'indexing', 'ready', 'failed'], message: 'Invalid RAG indexing status: {VALUE}' }, default: 'pending', required: true, index: true },
    ragMetadata: { type: ragMetadataSchema, default: () => ({ chunkCount: 0 }) },
    uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: [true, 'Uploader user reference is required'], index: true },
    version: { type: Number, default: 1, min: 1 },
    status: { type: String, enum: { values: ['draft', 'published', 'archived'], message: 'Invalid resource status: {VALUE}' }, default: 'draft', required: true, index: true },
    approvalStatus: { type: String, enum: { values: ['pending_review', 'approved', 'rejected'], message: 'Invalid approval status: {VALUE}' }, default: 'pending_review', required: true, index: true },
    processingJobId: { type: String, trim: true },
    processingFailureReason: { type: String, trim: true },
    replacedByResourceId: { type: Schema.Types.ObjectId, ref: 'LearningResource' },
    storageProvider: { type: String, trim: true, default: 's3' },
  },
  { collection: 'learning_resources', timestamps: true }
);

// Compound Indexes for fast tenant and RAG querying
learningResourceSchema.index({ institutionId: 1, category: 1 });
learningResourceSchema.index({ institutionId: 1, approvalStatus: 1 });
learningResourceSchema.index({ experimentId: 1, ragIndexingStatus: 1 });

export const LearningResource: Model<ILearningResource> =
  (mongoose.models['LearningResource'] as Model<ILearningResource>) ||
  mongoose.model<ILearningResource>('LearningResource', learningResourceSchema);
