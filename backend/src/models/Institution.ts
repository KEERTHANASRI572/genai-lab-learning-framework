import mongoose, { Schema, Document, Model } from 'mongoose';

export const INSTITUTION_TYPES = [
  'university',
  'engineering_technology_college',
  'engineering_college', // backward-compatible alias
  'arts_science_college',
  'medical_college_institute',
  'dental_college',
  'nursing_college',
  'pharmacy_college',
  'law_college_university',
  'agricultural_college_university',
  'veterinary_college',
  'allied_health_sciences_college',
  'physiotherapy_college',
  'architecture_planning_institute',
  'polytechnic_diploma_institute',
  'polytechnic_institute', // backward-compatible alias
  'teacher_education_college',
  'management_business_school',
  'research_institute',
  'arts_performing_arts_institute',
  'agricultural_fisheries_institute',
  'hotel_management_hospitality_institute',
  'sports_physical_education_college',
  'fashion_design_institute',
  'open_distance_education_institution',
  'vocational_skill_training_institute',
  'community_college',
  'other',
  'other_institution_type', // backward-compatible alias
] as const;

export type InstitutionType = (typeof INSTITUTION_TYPES)[number];

export interface InstitutionTypeOption {
  value: string;
  label: string;
}

export const INSTITUTION_TYPE_OPTIONS: InstitutionTypeOption[] = [
  { value: 'university', label: 'University' },
  { value: 'engineering_technology_college', label: 'Engineering & Technology College' },
  { value: 'arts_science_college', label: 'Arts & Science College' },
  { value: 'medical_college_institute', label: 'Medical College / Medical Institute' },
  { value: 'dental_college', label: 'Dental College' },
  { value: 'nursing_college', label: 'Nursing College' },
  { value: 'pharmacy_college', label: 'Pharmacy College' },
  { value: 'law_college_university', label: 'Law College / Law University' },
  { value: 'agricultural_college_university', label: 'Agricultural College / University' },
  { value: 'veterinary_college', label: 'Veterinary College' },
  { value: 'allied_health_sciences_college', label: 'Allied Health Sciences College' },
  { value: 'physiotherapy_college', label: 'Physiotherapy College' },
  { value: 'architecture_planning_institute', label: 'Architecture & Planning Institute' },
  { value: 'polytechnic_diploma_institute', label: 'Polytechnic / Diploma Institute' },
  { value: 'teacher_education_college', label: 'Teacher Education College' },
  { value: 'management_business_school', label: 'Management / Business School' },
  { value: 'research_institute', label: 'Research Institute' },
  { value: 'arts_performing_arts_institute', label: 'Arts & Performing Arts Institute' },
  { value: 'agricultural_fisheries_institute', label: 'Agricultural & Fisheries Institute' },
  { value: 'hotel_management_hospitality_institute', label: 'Hotel Management / Hospitality Institute' },
  { value: 'sports_physical_education_college', label: 'Sports & Physical Education College' },
  { value: 'fashion_design_institute', label: 'Fashion & Design Institute' },
  { value: 'open_distance_education_institution', label: 'Open / Distance Education Institution' },
  { value: 'vocational_skill_training_institute', label: 'Vocational / Skill Training Institute' },
  { value: 'community_college', label: 'Community College' },
  { value: 'other', label: 'Other Institution Type' },
];

export const formatInstitutionType = (type: string, otherType?: string): string => {
  if ((type === 'other' || type === 'other_institution_type') && otherType) {
    return `Other (${otherType})`;
  }
  const match = INSTITUTION_TYPE_OPTIONS.find((opt) => opt.value === type);
  if (match) return match.label;
  if (type === 'engineering_college') return 'Engineering & Technology College';
  if (type === 'polytechnic_institute') return 'Polytechnic / Diploma Institute';
  return type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

export type InstitutionStatus =
  | 'active'
  | 'pending_activation'
  | 'suspended'
  | 'trial';

export interface IInstitutionAddress {
  street?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
}

export interface IInstitutionSettings {
  maxStudents?: number;
  maxFaculty?: number;
  storageQuotaMb?: number;
  defaultAiModel?: string;
  enforceTwoFactor?: boolean;
  approvedEmailDomains?: string[];
  approvedFacultyEmails?: string[];
  approvedStudentEmails?: string[];
}

export interface IInstitution extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  code: string;
  domain: string;
  type: InstitutionType;
  otherInstitutionType?: string;
  status: InstitutionStatus;
  adminEmail: string;
  contactPhone?: string;
  address?: IInstitutionAddress;
  enabledModules: string[];
  settings: IInstitutionSettings;
  createdAt: Date;
  updatedAt: Date;
}

const institutionAddressSchema = new Schema<IInstitutionAddress>(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    postalCode: { type: String, trim: true },
  },
  { _id: false }
);

const institutionSettingsSchema = new Schema<IInstitutionSettings>(
  {
    maxStudents: { type: Number, default: 2000, min: 10 },
    maxFaculty: { type: Number, default: 150, min: 2 },
    storageQuotaMb: { type: Number, default: 51200, min: 1024 }, // 50 GB default
    defaultAiModel: { type: String, default: 'claude-3-5-sonnet' },
    enforceTwoFactor: { type: Boolean, default: false },
    approvedEmailDomains: { type: [String], default: [] },
    approvedFacultyEmails: { type: [String], default: [] },
    approvedStudentEmails: { type: [String], default: [] },
  },
  { _id: false }
);

export const institutionSchema = new Schema<IInstitution>(
  {
    name: {
      type: String,
      required: [true, 'Institution name is required'],
      trim: true,
      minlength: [2, 'Institution name must be at least 2 characters'],
      maxlength: [200, 'Institution name cannot exceed 200 characters'],
    },
    code: {
      type: String,
      required: [true, 'Institution code is required'],
      trim: true,
      uppercase: true,
      minlength: [2, 'Institution code must be at least 2 characters'],
      maxlength: [20, 'Institution code cannot exceed 20 characters'],
    },
    domain: {
      type: String,
      required: [true, 'Institutional domain is required'],
      trim: true,
      lowercase: true,
      match: [
        /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/,
        'Please enter a valid domain name (e.g., college.edu)',
      ],
    },
    type: {
      type: String,
      enum: {
        values: [...INSTITUTION_TYPES],
        message: 'Invalid institution type: {VALUE}',
      },
      default: 'university',
      required: true,
    },
    otherInstitutionType: {
      type: String,
      trim: true,
      maxlength: [100, 'Custom institution type cannot exceed 100 characters'],
    },
    status: {
      type: String,
      enum: {
        values: ['active', 'pending_activation', 'suspended', 'trial'],
        message: 'Invalid institution status: {VALUE}',
      },
      default: 'pending_activation',
      required: true,
      index: true,
    },
    adminEmail: {
      type: String,
      required: [true, 'Primary administrator email is required'],
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid administrator email address'],
    },
    contactPhone: {
      type: String,
      trim: true,
    },
    address: {
      type: institutionAddressSchema,
      default: () => ({}),
    },
    enabledModules: {
      type: [String],
      default: ['core', 'ai_learning', 'assessment'],
    },
    settings: {
      type: institutionSettingsSchema,
      default: () => ({}),
    },
  },
  {
    collection: 'institutions',
    timestamps: true,
  }
);

// Indexes
institutionSchema.index({ code: 1 }, { unique: true });
institutionSchema.index({ domain: 1 }, { unique: true });

export const Institution: Model<IInstitution> =
  (mongoose.models['Institution'] as Model<IInstitution>) ||
  mongoose.model<IInstitution>('Institution', institutionSchema);
