import mongoose, { Schema, Document, Model } from 'mongoose';

export type AuditRole = 'platform-admin' | 'college-admin' | 'faculty' | 'student' | 'system';
export type AuditTargetDomain =
  | 'auth'
  | 'institution'
  | 'academic'
  | 'curriculum'
  | 'assessment'
  | 'resource'
  | 'safety'
  | 'support'
  | 'system';

export type AuditStatus = 'success' | 'failure' | 'flagged';

export interface IAuditMetadata {
  requestId?: string;
  executionTimeMs?: number;
}

export interface IAuditLog extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId?: mongoose.Types.ObjectId;
  actorUserId?: mongoose.Types.ObjectId;
  actorEmail: string;
  actorRole: AuditRole;
  action: string;
  targetDomain: AuditTargetDomain;
  targetResourceId?: string;
  ipAddress: string;
  userAgent?: string;
  status: AuditStatus;
  details?: Record<string, unknown>;
  metadata?: IAuditMetadata;
  createdAt: Date;
}

// Strip sensitive security fields before saving into the immutable audit collection
const sanitizeAuditDetails = (details: unknown): Record<string, unknown> | undefined => {
  if (!details || typeof details !== 'object' || Array.isArray(details)) {
    return undefined;
  }

  const forbiddenKeys = /password|token|secret|hash|authorization|bearer|cookie|credential|key/i;
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (forbiddenKeys.test(key)) {
      sanitized[key] = '[REDACTED_BY_SECURITY_POLICY]';
    } else if (value && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditDetails(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
};

export const auditLogSchema = new Schema<IAuditLog>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      index: true,
      // Optional for system-wide platform-level audit events
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    actorEmail: {
      type: String,
      required: [true, 'Actor email identifier is required'],
      trim: true,
      lowercase: true,
    },
    actorRole: {
      type: String,
      enum: {
        values: ['platform-admin', 'college-admin', 'faculty', 'student', 'system'],
        message: 'Invalid actor role: {VALUE}',
      },
      required: [true, 'Actor role is required'],
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Audit action is required'],
      trim: true,
      maxlength: [100, 'Action string cannot exceed 100 characters'],
      index: true,
    },
    targetDomain: {
      type: String,
      enum: {
        values: [
          'auth',
          'institution',
          'academic',
          'curriculum',
          'assessment',
          'resource',
          'safety',
          'support',
          'system',
        ],
        message: 'Invalid target domain: {VALUE}',
      },
      required: [true, 'Target domain is required'],
      index: true,
    },
    targetResourceId: {
      type: String,
      trim: true,
      maxlength: [100, 'Target resource identifier cannot exceed 100 characters'],
    },
    ipAddress: {
      type: String,
      required: [true, 'Client IP address is required for audit trails'],
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: [500, 'User agent cannot exceed 500 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['success', 'failure', 'flagged'],
        message: 'Invalid audit status: {VALUE}',
      },
      required: [true, 'Audit status is required'],
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      set: sanitizeAuditDetails,
    },
    metadata: {
      requestId: { type: String, trim: true },
      executionTimeMs: { type: Number, min: 0 },
    },
  },
  {
    collection: 'audit_logs',
    timestamps: { createdAt: true, updatedAt: false }, // Immutable append-only audit trail
  }
);

// Indexes
auditLogSchema.index({ institutionId: 1, createdAt: -1 });
auditLogSchema.index({ actorEmail: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ targetDomain: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  (mongoose.models['AuditLog'] as Model<IAuditLog>) ||
  mongoose.model<IAuditLog>('AuditLog', auditLogSchema);
