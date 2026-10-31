import mongoose, { Schema, Document, Model } from 'mongoose';

export type DegreeLevel = 'undergraduate' | 'postgraduate' | 'diploma' | 'certificate';
export type CourseStatus = 'active' | 'inactive' | 'archived';

export interface ICourse extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  degreeLevel: DegreeLevel;
  totalSemesters: number;
  academicYear?: string;
  description?: string;
  status: CourseStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const courseSchema = new Schema<ICourse>(
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
    name: {
      type: String,
      required: [true, 'Course name is required'],
      trim: true,
      minlength: [2, 'Course name must be at least 2 characters'],
      maxlength: [200, 'Course name cannot exceed 200 characters'],
    },
    code: {
      type: String,
      required: [true, 'Course code is required'],
      trim: true,
      uppercase: true,
      minlength: [2, 'Course code must be at least 2 characters'],
      maxlength: [30, 'Course code cannot exceed 30 characters'],
    },
    degreeLevel: {
      type: String,
      enum: {
        values: ['undergraduate', 'postgraduate', 'diploma', 'certificate'],
        message: 'Invalid degree level: {VALUE}',
      },
      default: 'undergraduate',
      required: true,
    },
    totalSemesters: {
      type: Number,
      required: [true, 'Total semesters count is required'],
      min: [1, 'Course must have at least 1 semester'],
      max: [12, 'Course semesters cannot exceed 12'],
      default: 8,
    },
    academicYear: {
      type: String,
      trim: true,
      maxlength: [30, 'Academic year string cannot exceed 30 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Course description cannot exceed 1000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'archived'],
        message: 'Invalid course status: {VALUE}',
      },
      default: 'active',
      required: true,
      index: true,
    },
  },
  {
    collection: 'courses',
    timestamps: true,
  }
);

// Compound Unique Index: Course codes must be unique per department in an institution
courseSchema.index({ institutionId: 1, departmentId: 1, code: 1 }, { unique: true });
courseSchema.index({ institutionId: 1, status: 1 });

export const Course: Model<ICourse> =
  (mongoose.models['Course'] as Model<ICourse>) ||
  mongoose.model<ICourse>('Course', courseSchema);
