import mongoose, { Schema, Document, Model } from 'mongoose';

export type SubjectStatus = 'active' | 'inactive' | 'archived';

export interface ISubject extends Document {
  _id: mongoose.Types.ObjectId;
  institutionId: mongoose.Types.ObjectId;
  departmentId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  semester: number;
  credits: number;
  facultyLeadUserId?: mongoose.Types.ObjectId;
  facultyLeadName?: string;
  syllabusDescription?: string;
  status: SubjectStatus;
  createdAt: Date;
  updatedAt: Date;
}

export const subjectSchema = new Schema<ISubject>(
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
    name: {
      type: String,
      required: [true, 'Subject name is required'],
      trim: true,
      minlength: [2, 'Subject name must be at least 2 characters'],
      maxlength: [200, 'Subject name cannot exceed 200 characters'],
    },
    code: {
      type: String,
      required: [true, 'Subject code is required'],
      trim: true,
      uppercase: true,
      minlength: [2, 'Subject code must be at least 2 characters'],
      maxlength: [30, 'Subject code cannot exceed 30 characters'],
    },
    semester: {
      type: Number,
      required: [true, 'Semester number is required'],
      min: [1, 'Semester must be at least 1'],
      max: [12, 'Semester cannot exceed 12'],
    },
    credits: {
      type: Number,
      min: [0, 'Credits cannot be negative'],
      max: [20, 'Credits cannot exceed 20'],
      default: 3,
    },
    facultyLeadUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    facultyLeadName: {
      type: String,
      trim: true,
      maxlength: [100, 'Faculty lead name cannot exceed 100 characters'],
    },
    syllabusDescription: {
      type: String,
      trim: true,
      maxlength: [2000, 'Syllabus description cannot exceed 2000 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'archived'],
        message: 'Invalid subject status: {VALUE}',
      },
      default: 'active',
      required: true,
      index: true,
    },
  },
  {
    collection: 'subjects',
    timestamps: true,
  }
);

// Compound Unique Index: Subject codes must be unique per course in an institution
subjectSchema.index({ institutionId: 1, courseId: 1, code: 1 }, { unique: true });
subjectSchema.index({ institutionId: 1, semester: 1 });

export const Subject: Model<ISubject> =
  (mongoose.models['Subject'] as Model<ISubject>) ||
  mongoose.model<ISubject>('Subject', subjectSchema);
