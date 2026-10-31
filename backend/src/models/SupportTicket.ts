import mongoose, { Schema, Document, Model } from 'mongoose';

export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type SupportTicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';

export interface ISupportTicket extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  ticketNumber: string;
  subject: string;
  description: string;
  departmentId?: mongoose.Types.ObjectId;
  submittedByUserId: mongoose.Types.ObjectId;
  priority: SupportTicketPriority;
  status: SupportTicketStatus;
  resolutionNotes?: string;
  resolvedAt?: Date;
  resolvedByUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export const supportTicketSchema = new Schema<ISupportTicket>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institutional tenancy (institutionId) is required'],
      index: true,
    },
    ticketNumber: {
      type: String,
      required: [true, 'Ticket number is required'],
      unique: true,
      trim: true,
      index: true,
    },
    subject: {
      type: String,
      required: [true, 'Ticket subject is required'],
      trim: true,
      minlength: [3, 'Subject must be at least 3 characters'],
      maxlength: [200, 'Subject cannot exceed 200 characters'],
    },
    description: {
      type: String,
      required: [true, 'Ticket description is required'],
      trim: true,
      minlength: [5, 'Description must be at least 5 characters'],
      maxlength: [5000, 'Description cannot exceed 5000 characters'],
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    submittedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Submitter user reference is required'],
      index: true,
    },
    priority: {
      type: String,
      enum: {
        values: ['low', 'medium', 'high', 'urgent'],
        message: 'Invalid ticket priority: {VALUE}',
      },
      default: 'medium',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['open', 'in_progress', 'resolved', 'closed'],
        message: 'Invalid ticket status: {VALUE}',
      },
      default: 'open',
      required: true,
      index: true,
    },
    resolutionNotes: {
      type: String,
      trim: true,
      maxlength: [3000, 'Resolution notes cannot exceed 3000 characters'],
    },
    resolvedAt: {
      type: Date,
    },
    resolvedByUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { collection: 'support_tickets', timestamps: true }
);

// Compound indexes for tenant queries
supportTicketSchema.index({ institutionId: 1, status: 1 });
supportTicketSchema.index({ institutionId: 1, priority: 1 });
supportTicketSchema.index({ institutionId: 1, createdAt: -1 });

export const SupportTicket: Model<ISupportTicket> =
  (mongoose.models['SupportTicket'] as Model<ISupportTicket>) ||
  mongoose.model<ISupportTicket>('SupportTicket', supportTicketSchema);

