export type UserRole = 'platform-admin' | 'college-admin' | 'faculty' | 'student';

export type PlatformView =
  | 'platform-overview'
  | 'platform-institutions'
  | 'platform-modules'
  | 'platform-activity'
  | 'platform-analytics'
  | 'platform-ai-health'
  | 'platform-audit-logs'
  | 'platform-support';

export type CollegeView =
  | 'college-overview'
  | 'college-academic-structure'
  | 'college-users'
  | 'college-roles'
  | 'college-resources'
  | 'college-analytics'
  | 'college-student-progress'
  | 'college-faculty-activity'
  | 'college-support';

export type FacultyView =
  | 'faculty-dashboard'
  | 'faculty-experiments'
  | 'faculty-resources'
  | 'faculty-assessments'
  | 'faculty-student-progress'
  | 'faculty-learning-gaps'
  | 'faculty-help-requests'
  | 'faculty-analytics';

export type StudentView =
  | 'student-dashboard'
  | 'student-experiments'
  | 'student-experiment-overview'
  | 'student-initial-assessment'
  | 'student-learning-level'
  | 'student-workspace'
  | 'student-final-assessment'
  | 'student-profile'
  | 'student-support';

export type SharedView = 'login' | 'settings' | 'notifications';

export type AppView = PlatformView | CollegeView | FacultyView | StudentView | SharedView;

export interface NavItem {
  id: AppView;
  label: string;
  iconName: string;
  badge?: string;
}

export interface BreadcrumbItem {
  label: string;
  view?: AppView;
}
