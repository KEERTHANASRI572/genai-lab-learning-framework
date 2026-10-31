import mongoose, { Schema, Document, Model } from 'mongoose';

export type UserRole = 'platform-admin' | 'college-admin' | 'faculty' | 'student';
export type UserStatus = 'active' | 'inactive' | 'suspended' | 'pending_activation';

export interface IUserProfile {
  avatarUrl?: string;
  phone?: string;
  designation?: string;
  studentIdNumber?: string;
  enrolledCourseIds?: mongoose.Types.ObjectId[];
}

export interface IUserSecurity {
  failedLoginAttempts: number;
  lockoutUntil?: Date;
  passwordResetTokenHash?: string;
  passwordResetExpiresAt?: Date;
  activeRefreshTokenHash?: string;
  invitationTokenHash?: string;
  invitationExpiresAt?: Date;
  lastInvitationSentAt?: Date;
  lastPasswordResetRequestedAt?: Date;
}

export interface IUser extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: UserRole;
  institutionId?: mongoose.Types.ObjectId;
  departmentId?: mongoose.Types.ObjectId;
  courseId?: mongoose.Types.ObjectId;
  status: UserStatus;
  lastLoginAt?: Date;
  profile: IUserProfile;
  security: IUserSecurity;
  createdAt: Date;
  updatedAt: Date;
}

const userProfileSchema = new Schema<IUserProfile>(
  {
    avatarUrl: { type: String, trim: true },
    phone: { type: String, trim: true },
    designation: { type: String, trim: true },
    studentIdNumber: { type: String, trim: true },
    enrolledCourseIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],
  },
  { _id: false }
);

const userSecuritySchema = new Schema<IUserSecurity>(
  {
    failedLoginAttempts: { type: Number, default: 0, min: 0 },
    lockoutUntil: { type: Date },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiresAt: { type: Date },
    activeRefreshTokenHash: { type: String, select: false },
    invitationTokenHash: { type: String, select: false },
    invitationExpiresAt: { type: Date },
    lastInvitationSentAt: { type: Date },
    lastPasswordResetRequestedAt: { type: Date },
  },
  { _id: false }
);

export const userSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'User full name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email address is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email address'],
      index: true,
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
      select: false, // Protected: never returned in query projections by default
      minlength: [20, 'Password hash format is invalid'],
    },
    role: {
      type: String,
      enum: {
        values: ['platform-admin', 'college-admin', 'faculty', 'student'],
        message: 'Invalid user role: {VALUE}',
      },
      required: [true, 'User role is required'],
      index: true,
    },
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'Institution',
      required: function (this: IUser) {
        // Platform Admins are system-level and do not require an institutional boundary
        return this.role !== 'platform-admin';
      },
      index: true,
    },
    departmentId: {
      type: Schema.Types.ObjectId,
      ref: 'Department',
      index: true,
    },
    courseId: {
      type: Schema.Types.ObjectId,
      ref: 'Course',
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'inactive', 'suspended', 'pending_activation'],
        message: 'Invalid user status: {VALUE}',
      },
      default: 'active',
      required: true,
      index: true,
    },
    lastLoginAt: {
      type: Date,
    },
    profile: {
      type: userProfileSchema,
      default: () => ({}),
    },
    security: {
      type: userSecuritySchema,
      default: () => ({ failedLoginAttempts: 0 }),
    },
  },
  {
    collection: 'users',
    timestamps: true,
  }
);

// Compound Unique Index: Users within an institution must have distinct emails
// Sparse allows platform admins with no institutionId to also register cleanly
userSchema.index({ institutionId: 1, email: 1 }, { unique: true, sparse: true });
userSchema.index({ institutionId: 1, role: 1 });
userSchema.index({ institutionId: 1, status: 1 });

export const User: Model<IUser> =
  (mongoose.models['User'] as Model<IUser>) ||
  mongoose.model<IUser>('User', userSchema);
