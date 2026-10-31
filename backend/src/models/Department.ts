import mongoose, { Schema, Document, Model } from 'mongoose';

export type DepartmentStatus = 'active' | 'inactive' | 'archived';

export interface IDepartment extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  headOfDepartment?: string;
  headOfDepartmentUserId?: mongoose.Types.ObjectId;
  description?: string;
  status: DepartmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const departmentSchema = new Schema<IDepartment>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: [true, 'Institutional tenancy (institutionId) is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Department name is required'],
      trim: true,
      minlength: [2, 'Department name must be at least 2 characters'],
      maxlength: [150, 'Department name cannot exceed 150 characters'],
    },
    code: {
      type: String,
      required: [true, 'Department code is required'],
      trim: true,
      uppercase: true,
      minlength: [2, 'Department code must be at least 2 characters'],
      maxlength: [20, 'Department code cannot exceed 20 characters'],
    },
    headOfDepartment: {
      type: String,
      trim: true,
      maxlength: [100, 'Head of Department title cannot exceed 100 characters'],
    },
    headOfDepartmentUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Department description cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'archived'],
        message: 'Invalid department status: {VALUE}',
      },
      default: 'active',
      required: true,
      index: true,
    },
  },
  {
    collection: 'departments',
    timestamps: true,
  }
);

// Compound Unique Index: Department codes must be unique per institution
departmentSchema.index({ institutionId: 1, code: 1 }, { unique: true });
departmentSchema.index({ institutionId: 1, status: 1 });

export const Department: Model<IDepartment> =
  (mongoose.models['Department'] as Model<IDepartment>) ||
  mongoose.model<IDepartment>('Department', departmentSchema);
