export const INSTITUTION_TYPES = [
  'university',
  'engineering_technology_college',
  'engineering_college',
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
  'polytechnic_institute',
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
  'other_institution_type',
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

export type InstitutionStatus = 'active' | 'pending_activation' | 'suspended' | 'trial';

export interface Institution {
  id: string;
  name: string;
  code: string;
  domain: string;
  type: InstitutionType;
  otherInstitutionType?: string;
  status: InstitutionStatus;
  adminEmail: string;
  departmentCount: number;
  facultyCount: number;
  studentCount: number;
  enabledModules: string[];
  createdAt: string;
}

export interface ConfigurableModule {
  id: string;
  name: string;
  description: string;
  category: 'core' | 'ai_learning' | 'assessment' | 'governance';
  isDefault: boolean;
  requiredForAccreditation: boolean;
}

export interface AIServiceHealthMetrics {
  provider: string;
  model: string;
  status: 'healthy' | 'degraded' | 'offline';
  avgLatencyMs: number;
  tokenConsumptionToday: number;
  monthlyQuotaAllocated: number;
  monthlyQuotaUsed: number;
  errorRatePercent: number;
  retrievalP95Ms: number;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  targetDomain: string;
  institutionId?: string;
  institutionName?: string;
  ipAddress: string;
  status: 'success' | 'failure' | 'flagged';
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  institutionName: string;
  requesterName: string;
  requesterRole: string;
  subject: string;
  category: 'platform_bug' | 'ai_hallucination_report' | 'tenant_isolation' | 'quota_request' | 'general';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'escalated' | 'resolved';
  createdAt: string;
  lastUpdated: string;
}
