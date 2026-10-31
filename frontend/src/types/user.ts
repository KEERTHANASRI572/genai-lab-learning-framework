import { UserRole } from './navigation';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  institutionId: string;
  institutionName: string;
  departmentName?: string;
  avatarUrl?: string;
  lastLogin: string;
}
