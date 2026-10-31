import mongoose, { Schema, Document, Model } from 'mongoose';

export type LaboratoryStatus = 'active' | 'maintenance' | 'inactive';

export interface ILaboratory extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  subjectId?: mongoose.Types.ObjectId;
  name: string;
  code: string;
  location?: string;
  capacity: number;
  safetyProtocolRef?: string;
  facultyInChargeUserId?: mongoose.Types.ObjectId;
  status: LaboratoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const laboratorySchema = new Schema<ILaboratory>(
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
    name: {
      type: String,
      required: [true, 'Laboratory name is required'],
      trim: true,
      minlength: [2, 'Laboratory name must be at least 2 characters'],
      maxlength: [200, 'Laboratory name cannot exceed 200 characters'],
    },
    code: {
      type: String,
      required: [true, 'Laboratory code is required'],
      trim: true,
      uppercase: true,
      minlength: [2, 'Laboratory code must be at least 2 characters'],
      maxlength: [30, 'Laboratory code cannot exceed 30 characters'],
    },
    location: {
      type: String,
      trim: true,
      maxlength: [150, 'Location description cannot exceed 150 characters'],
    },
    capacity: {
      type: Number,
      min: [1, 'Capacity must be at least 1 student workstation'],
      default: 40,
    },
    safetyProtocolRef: {
      type: String,
      trim: true,
      maxlength: [200, 'Safety protocol reference cannot exceed 200 characters'],
    },
    facultyInChargeUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'maintenance', 'inactive'],
        message: 'Invalid laboratory status: {VALUE}',
      },
      default: 'active',
      required: true,
      index: true,
    },
  },
  {
    collection: 'laboratories',
    timestamps: true,
  }
);

// Compound Unique Index: Lab codes must be unique per course in an institution
laboratorySchema.index({ institutionId: 1, courseId: 1, code: 1 }, { unique: true });
laboratorySchema.index({ institutionId: 1, status: 1 });

export const Laboratory: Model<ILaboratory> =
  (mongoose.models['Laboratory'] as Model<ILaboratory>) ||
  mongoose.model<ILaboratory>('Laboratory', laboratorySchema);
