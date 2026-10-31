// IngestionJob model – durable queue for resource processing
import mongoose, { Schema, Document, Model } from 'mongoose';

export type IngestionJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export interface IIngestionJob extends Document {
  resourceId: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  uploadedByUserId: mongoose.Types.ObjectId;
  status: IngestionJobStatus;
  attempts: number;
  maxAttempts: number;
  lastAttemptAt?: Date;
  nextRunAt: Date;
  failureReason?: string;
  pipelineVersion?: string;
  processingLeaseExpiresAt?: Date;
  processingLeaseToken?: string;
  processingMetrics?: {
    chunkCount?: number;
    embeddingModel?: string;
    durationMs?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const ingestionJobSchema = new Schema<IIngestionJob>(
  {
    resourceId: { type: Schema.Types.ObjectId, ref: 'LearningResource', required: true, index: true },
    institutionId: { type: Schema.Types.ObjectId, ref: 'Institution', required: true, index: true },
    uploadedByUserId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    status: {
      type: String,
      enum: { values: ['queued', 'processing', 'completed', 'failed'], message: 'Invalid job status: {VALUE}' },
      default: 'queued',
      required: true,
      index: true,
    },
    attempts: { type: Number, default: 0, min: 0 },
    maxAttempts: { type: Number, default: 3, min: 1 },
    lastAttemptAt: { type: Date },
    nextRunAt: { type: Date, required: true, index: true },
    failureReason: { type: String, trim: true },
    pipelineVersion: { type: String, trim: true },
    processingLeaseExpiresAt: { type: Date },
    processingLeaseToken: { type: String, trim: true },
    processingMetrics: {
      chunkCount: { type: Number },
      embeddingModel: { type: String, trim: true },
      durationMs: { type: Number },
    },
  },
  { timestamps: true }
);

// Indexes for efficient job picking
ingestionJobSchema.index({ status: 1, nextRunAt: 1 });
ingestionJobSchema.index({ resourceId: 1 });

export const IngestionJob: Model<IIngestionJob> =
  (mongoose.models['IngestionJob'] as Model<IIngestionJob>) ||
  mongoose.model<IIngestionJob>('IngestionJob', ingestionJobSchema);

