import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { AppLayout } from './components/layout/AppLayout';
import { NotFoundState } from './components/states/NotFoundState';
import { LoadingState } from './components/states/LoadingState';
import { AccessDenied } from './components/states/AccessDenied';
import { AppView, UserRole } from './types/navigation';

// Auth View
import { LoginView } from './views/auth/LoginView';

// Platform Admin Views
import { PlatformOverviewView } from './views/platform/PlatformOverviewView';
import { InstitutionOnboardingView } from './views/platform/InstitutionOnboardingView';
import { ModuleManagementView } from './views/platform/ModuleManagementView';
import { PlatformActivityView } from './views/platform/PlatformActivityView';
import { PlatformAnalyticsView } from './views/platform/PlatformAnalyticsView';
import { AIServiceHealthView } from './views/platform/AIServiceHealthView';
import { PlatformAuditLogsView } from './views/platform/PlatformAuditLogsView';
import { PlatformSupportView } from './views/platform/PlatformSupportView';

// College Admin Views
import { CollegeOverviewView } from './views/college/CollegeOverviewView';
import { AcademicHierarchyView } from './views/college/AcademicHierarchyView';
import { UserManagementView } from './views/college/UserManagementView';
import { RoleManagementView } from './views/college/RoleManagementView';
import { LearningResourcesView } from './views/college/LearningResourcesView';
import { CollegeAnalyticsView } from './views/college/CollegeAnalyticsView';
import { StudentInterventionsView } from './views/college/StudentInterventionsView';
import { FacultyParticipationView } from './views/college/FacultyParticipationView';
import { CollegeSupportView } from './views/college/CollegeSupportView';

// Faculty Views
import { FacultyDashboardView } from './views/faculty/FacultyDashboardView';
import { ExperimentAuthoringView } from './views/faculty/ExperimentAuthoringView';
import { FacultyResourcesView } from './views/faculty/FacultyResourcesView';
import { AssessmentConfigView } from './views/faculty/AssessmentConfigView';
import { StudentProgressView } from './views/faculty/StudentProgressView';
import { LearningGapsView } from './views/faculty/LearningGapsView';
import { HelpRequestsView } from './views/faculty/HelpRequestsView';
import { FacultyAnalyticsView } from './views/faculty/FacultyAnalyticsView';

// Student Views
import { StudentDashboardView } from './views/student/StudentDashboardView';
import { ExperimentBrowserView } from './views/student/ExperimentBrowserView';
import { ExperimentOverviewView } from './views/student/ExperimentOverviewView';
import { InitialAssessmentView } from './views/student/InitialAssessmentView';
import { LearningLevelView } from './views/student/LearningLevelView';
import { LabWorkspaceView } from './views/student/LabWorkspaceView';
import { FinalAssessmentView } from './views/student/FinalAssessmentView';
import { LearnerProfileView } from './views/student/LearnerProfileView';
import { StudentSupportView } from './views/student/StudentSupportView';

// Shared Views
import { SettingsView } from './views/shared/SettingsView';
import { NotificationsView } from './views/shared/NotificationsView';

const roleAllowedViews: Record<UserRole, AppView[]> = {
  'platform-admin': [
    'platform-overview',
    'platform-institutions',
    'platform-modules',
    'platform-activity',
    'platform-analytics',
    'platform-ai-health',
    'platform-audit-logs',
    'platform-support',
    'settings',
    'notifications',
  ],
  'college-admin': [
    'college-overview',
    'college-academic-structure',
    'college-users',
    'college-roles',
    'college-resources',
    'college-analytics',
    'college-student-progress',
    'college-faculty-activity',
    'college-support',
    'settings',
    'notifications',
  ],
  'faculty': [
    'faculty-dashboard',
    'faculty-experiments',
    'faculty-resources',
    'faculty-assessments',
    'faculty-student-progress',
    'faculty-learning-gaps',
    'faculty-help-requests',
    'faculty-analytics',
    'settings',
    'notifications',
  ],
  'student': [
    'student-dashboard',
    'student-experiments',
    'student-experiment-overview',
    'student-initial-assessment',
    'student-learning-level',
    'student-workspace',
    'student-final-assessment',
    'student-profile',
    'student-support',
    'settings',
    'notifications',
  ],
};

const ViewRouter: React.FC = () => {
  const { currentView, isAuthenticated, isLoadingSession, currentRole } = useApp();

  // If opening an invitation activation (?token=... or /activate) or reset link, always show LoginView
  const isAuthActionUrl = () => {
    if (typeof window === 'undefined') return false;
    const urlParams = new URLSearchParams(window.location.search);
    const path = window.location.pathname;
    return (
      Boolean(urlParams.get('token')) ||
      path.includes('/activate') ||
      path.includes('/reset') ||
      urlParams.get('mode') === 'reset' ||
      urlParams.get('mode') === 'activate'
    );
  };

  if (isAuthActionUrl()) {
    return <LoginView />;
  }

  if (isLoadingSession) {
    return (
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <LoadingState message="Verifying secure institutional session..." />
      </div>
    );
  }

  // Unauthenticated users are strictly held at the institutional login page
  if (!isAuthenticated || currentView === 'login') {
    return <LoginView />;
  }

  // Role authorization check for active view
  if (currentRole && !roleAllowedViews[currentRole]?.includes(currentView)) {
    return (
      <AppLayout>
        <AccessDenied requiredRole={currentRole} />
      </AppLayout>
    );
  }

  const renderView = () => {
    switch (currentView) {
      // Platform Admin
      case 'platform-overview':
        return <PlatformOverviewView />;
      case 'platform-institutions':
        return <InstitutionOnboardingView />;
      case 'platform-modules':
        return <ModuleManagementView />;
      case 'platform-activity':
        return <PlatformActivityView />;
      case 'platform-analytics':
        return <PlatformAnalyticsView />;
      case 'platform-ai-health':
        return <AIServiceHealthView />;
      case 'platform-audit-logs':
        return <PlatformAuditLogsView />;
      case 'platform-support':
        return <PlatformSupportView />;

      // College Admin
      case 'college-overview':
        return <CollegeOverviewView />;
      case 'college-academic-structure':
        return <AcademicHierarchyView />;
      case 'college-users':
        return <UserManagementView />;
      case 'college-roles':
        return <RoleManagementView />;
      case 'college-resources':
        return <LearningResourcesView />;
      case 'college-analytics':
        return <CollegeAnalyticsView />;
      case 'college-student-progress':
        return <StudentInterventionsView />;
      case 'college-faculty-activity':
        return <FacultyParticipationView />;
      case 'college-support':
        return <CollegeSupportView />;

      // Faculty
      case 'faculty-dashboard':
        return <FacultyDashboardView />;
      case 'faculty-experiments':
        return <ExperimentAuthoringView />;
      case 'faculty-resources':
        return <FacultyResourcesView />;
      case 'faculty-assessments':
        return <AssessmentConfigView />;
      case 'faculty-student-progress':
        return <StudentProgressView />;
      case 'faculty-learning-gaps':
        return <LearningGapsView />;
      case 'faculty-help-requests':
        return <HelpRequestsView />;
      case 'faculty-analytics':
        return <FacultyAnalyticsView />;

      // Student
      case 'student-dashboard':
        return <StudentDashboardView />;
      case 'student-experiments':
        return <ExperimentBrowserView />;
      case 'student-experiment-overview':
        return <ExperimentOverviewView />;
      case 'student-initial-assessment':
        return <InitialAssessmentView />;
      case 'student-learning-level':
        return <LearningLevelView />;
      case 'student-workspace':
        return <LabWorkspaceView />;
      case 'student-final-assessment':
        return <FinalAssessmentView />;
      case 'student-profile':
        return <LearnerProfileView />;
      case 'student-support':
        return <StudentSupportView />;

      // Shared
      case 'settings':
        return <SettingsView />;
      case 'notifications':
        return <NotificationsView />;

      default:
        return <NotFoundState />;
    }
  };

  return <AppLayout>{renderView()}</AppLayout>;
};

export const App: React.FC = () => {
  return (
    <AppProvider>
      <ViewRouter />
    </AppProvider>
  );
};

export default App;
