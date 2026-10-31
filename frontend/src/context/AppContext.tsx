import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserRole, AppView, BreadcrumbItem } from '../types/navigation';
import { UserProfile } from '../types/user';
import { getCurrentUser, loginUser, logoutUser, refreshSession } from '../services/api';

export interface BackendHealthState {
  isLive: boolean;
  isReady: boolean;
  statusText: string;
  databaseName?: string;
  checkedAt: string;
}

export interface AppContextType {
  currentRole: UserRole | null;
  currentView: AppView;
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoadingSession: boolean;
  activeInstitution: string;
  activeCourseId: string | null;
  activeCourseName: string;
  activeLabId: string | null;
  activeLabName: string;
  activeSubjectId: string | null;
  activeSubjectName: string;
  activeExperimentId: string | null;
  activeExperimentTitle: string;
  activeExperimentCode: string;
  activeAttemptId: string | null;
  activeSessionId: string | null;
  backendHealth: BackendHealthState;
  breadcrumbs: BreadcrumbItem[];
  setCurrentView: (view: AppView) => void;
  setActiveInstitution: (name: string) => void;
  setActiveCourseId: (id: string | null, name?: string) => void;
  setActiveLabId: (id: string | null, name?: string) => void;
  setActiveSubjectId: (id: string | null, name?: string) => void;
  setActiveExperimentId: (id: string | null, title?: string, code?: string) => void;
  setActiveAttemptId: (id: string | null) => void;
  setActiveSessionId: (id: string | null) => void;
  refreshBackendHealth: () => Promise<void>;
  login: (credentials: { email: string; password: string }) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
}

export const defaultRoleViews: Record<UserRole, AppView> = {
  'platform-admin': 'platform-overview',
  'college-admin': 'college-overview',
  'faculty': 'faculty-dashboard',
  'student': 'student-dashboard',
};

const AppContext = createContext<AppContextType | undefined>(undefined);

const getStored = (key: string, fallback: string | null = null): string | null => {
  if (typeof window === 'undefined') return fallback;
  try {
    return sessionStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [currentView, setCurrentViewState] = useState<AppView>(() => {
    const stored = getStored('genai_active_current_view');
    return (stored as AppView) || 'login';
  });
  const [activeInstitution, setActiveInstitution] = useState<string>('');
  const [activeCourseId, setActiveCourseIdState] = useState<string | null>(() => getStored('genai_active_course_id'));
  const [activeCourseName, setActiveCourseName] = useState<string>(() => getStored('genai_active_course_name', '') || '');
  const [activeLabId, setActiveLabIdState] = useState<string | null>(() => getStored('genai_active_lab_id'));
  const [activeLabName, setActiveLabName] = useState<string>(() => getStored('genai_active_lab_name', '') || '');
  const [activeSubjectId, setActiveSubjectIdState] = useState<string | null>(() => getStored('genai_active_subject_id'));
  const [activeSubjectName, setActiveSubjectName] = useState<string>(() => getStored('genai_active_subject_name', '') || '');
  const [activeExperimentId, setActiveExperimentIdState] = useState<string | null>(() => getStored('genai_active_experiment_id'));
  const [activeExperimentTitle, setActiveExperimentTitle] = useState<string>(() => getStored('genai_active_experiment_title', '') || '');
  const [activeExperimentCode, setActiveExperimentCode] = useState<string>(() => getStored('genai_active_experiment_code', '') || '');
  const [activeAttemptId, setActiveAttemptIdState] = useState<string | null>(() => getStored('genai_active_attempt_id'));
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(() => getStored('genai_active_session_id'));
  const [isLoadingSession, setIsLoadingSession] = useState<boolean>(true);
  const [backendHealth, setBackendHealth] = useState<BackendHealthState>({
    isLive: false,
    isReady: false,
    statusText: 'Connecting...',
    checkedAt: new Date().toLocaleTimeString(),
  });

  const currentRole: UserRole | null = user?.role ?? null;
  const isAuthenticated: boolean = !!user;

  // Restore authenticated session safely on startup or refresh
  const checkSession = useCallback(async () => {
    // If arriving via an activation or reset link, do not restore an existing session
    // from a different role/user in this browser; hold strictly at the activation/reset page.
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const path = typeof window !== 'undefined' ? window.location.pathname : '';
    const isAuthAction = Boolean(urlParams?.get('token')) || path.includes('/activate') || path.includes('/reset');

    if (isAuthAction) {
      setUser(null);
      setCurrentViewState('login');
      setIsLoadingSession(false);
      return;
    }

    setIsLoadingSession(true);
    try {
      let meRes = await getCurrentUser();

      // If access token expired, attempt automatic single-use refresh token exchange
      if (!meRes.success) {
        const refreshRes = await refreshSession();
        if (refreshRes.success) {
          meRes = await getCurrentUser();
        }
      }

      if (meRes.success && meRes.data) {
        const dto = meRes.data;
        const profile: UserProfile = {
          id: dto.id,
          name: dto.name,
          email: dto.email,
          role: dto.role,
          institutionId: dto.institutionId || '',
          institutionName:
            dto.institution?.name ||
            (dto.role === 'platform-admin' ? 'Platform Administration' : 'Institutional Workspace'),
          departmentName:
            dto.profile?.designation ||
            (dto.role === 'student' ? 'Student Workspace' : 'Department Faculty'),
          lastLogin: dto.lastLoginAt ? new Date(dto.lastLoginAt).toLocaleString() : 'Active Session',
        };

        setUser(profile);
        setActiveInstitution(profile.institutionName);
        const storedView = getStored('genai_active_current_view') as AppView | null;
        if (storedView && storedView !== 'login') {
          setCurrentViewState(storedView);
        } else {
          setCurrentViewState((prev) => (prev === 'login' ? defaultRoleViews[profile.role] : prev));
        }
      } else {
        setUser(null);
        setCurrentViewState('login');
      }
    } catch {
      setUser(null);
      setCurrentViewState('login');
    } finally {
      setIsLoadingSession(false);
    }
  }, []);

  // Perform server-authenticated login
  const login = async (credentials: {
    email: string;
    password: string;
  }): Promise<{ success: boolean; error?: string }> => {
    try {
      const loginRes = await loginUser(credentials);
      if (!loginRes.success || !loginRes.data) {
        return {
          success: false,
          error: loginRes.error?.message || 'Invalid institutional email or password.',
        };
      }

      // Fetch complete populated profile from /auth/me
      const meRes = await getCurrentUser();
      const userData = meRes.success && meRes.data ? meRes.data : loginRes.data.user;

      const profile: UserProfile = {
        id: userData.id,
        name: userData.name,
        email: userData.email,
        role: userData.role,
        institutionId: userData.institutionId || '',
        institutionName:
          userData.institution?.name ||
          (userData.role === 'platform-admin' ? 'Platform Administration' : 'Institutional Workspace'),
        departmentName:
          userData.profile?.designation ||
          (userData.role === 'student' ? 'Student Workspace' : 'Department Faculty'),
        lastLogin: userData.lastLoginAt ? new Date(userData.lastLoginAt).toLocaleString() : 'Just now',
      };

      setUser(profile);
      setActiveInstitution(profile.institutionName);
      const targetView = defaultRoleViews[profile.role];
      setCurrentViewState(targetView);
      try {
        sessionStorage.setItem('genai_active_current_view', targetView);
      } catch {}
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network failure during authentication.';
      return { success: false, error: msg };
    }
  };

  // Perform secure server-side logout
  const logout = async (): Promise<void> => {
    try {
      await logoutUser();
    } catch {
      // Continue client cleanup even if network request fails
    } finally {
      try {
        sessionStorage.removeItem('genai_active_current_view');
        sessionStorage.removeItem('genai_active_course_id');
        sessionStorage.removeItem('genai_active_course_name');
        sessionStorage.removeItem('genai_active_lab_id');
        sessionStorage.removeItem('genai_active_lab_name');
        sessionStorage.removeItem('genai_active_subject_id');
        sessionStorage.removeItem('genai_active_subject_name');
        sessionStorage.removeItem('genai_active_experiment_id');
        sessionStorage.removeItem('genai_active_experiment_title');
        sessionStorage.removeItem('genai_active_experiment_code');
        sessionStorage.removeItem('genai_active_attempt_id');
        sessionStorage.removeItem('genai_active_session_id');
      } catch {}
      setUser(null);
      setActiveInstitution('');
      setCurrentViewState('login');
    }
  };

  const setActiveCourseId = (id: string | null, name?: string) => {
    setActiveCourseIdState(id);
    setActiveCourseName(name || '');
    try {
      if (id) {
        sessionStorage.setItem('genai_active_course_id', id);
        if (name) sessionStorage.setItem('genai_active_course_name', name);
      } else {
        sessionStorage.removeItem('genai_active_course_id');
        sessionStorage.removeItem('genai_active_course_name');
      }
    } catch {}
  };

  const setActiveLabId = (id: string | null, name?: string) => {
    setActiveLabIdState(id);
    setActiveLabName(name || '');
    try {
      if (id) {
        sessionStorage.setItem('genai_active_lab_id', id);
        if (name) sessionStorage.setItem('genai_active_lab_name', name);
      } else {
        sessionStorage.removeItem('genai_active_lab_id');
        sessionStorage.removeItem('genai_active_lab_name');
      }
    } catch {}
  };

  const setActiveSubjectId = (id: string | null, name?: string) => {
    setActiveSubjectIdState(id);
    setActiveSubjectName(name || '');
    try {
      if (id) {
        sessionStorage.setItem('genai_active_subject_id', id);
        if (name) sessionStorage.setItem('genai_active_subject_name', name);
      } else {
        sessionStorage.removeItem('genai_active_subject_id');
        sessionStorage.removeItem('genai_active_subject_name');
      }
    } catch {}
  };

  const setActiveExperimentId = (id: string | null, title?: string, code?: string) => {
    setActiveExperimentIdState(id);
    if (title !== undefined) setActiveExperimentTitle(title);
    if (code !== undefined) setActiveExperimentCode(code);
    try {
      if (id) {
        sessionStorage.setItem('genai_active_experiment_id', id);
        if (title) sessionStorage.setItem('genai_active_experiment_title', title);
        if (code) sessionStorage.setItem('genai_active_experiment_code', code);
      } else {
        sessionStorage.removeItem('genai_active_experiment_id');
        sessionStorage.removeItem('genai_active_experiment_title');
        sessionStorage.removeItem('genai_active_experiment_code');
      }
    } catch {}
  };

  const setActiveAttemptId = (id: string | null) => {
    setActiveAttemptIdState(id);
    try {
      if (id) {
        sessionStorage.setItem('genai_active_attempt_id', id);
      } else {
        sessionStorage.removeItem('genai_active_attempt_id');
      }
    } catch {}
  };

  const setActiveSessionId = (id: string | null) => {
    setActiveSessionIdState(id);
    try {
      if (id) {
        sessionStorage.setItem('genai_active_session_id', id);
      } else {
        sessionStorage.removeItem('genai_active_session_id');
      }
    } catch {}
  };

  const setCurrentView = (view: AppView) => {
    // If not authenticated, force login view
    if (!user && view !== 'login') {
      setCurrentViewState('login');
      return;
    }
    setCurrentViewState(view);
    try {
      sessionStorage.setItem('genai_active_current_view', view);
    } catch {}
  };

  // Check actual live backend health from localhost:5000 (Express server)
  const refreshBackendHealth = async () => {
    const backendBase =
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BACKEND_URL) || 'http://localhost:5000';
    try {
      const liveRes = await fetch(`${backendBase}/api/health`);
      const isLive = liveRes.ok;

      let isReady = false;
      let dbName: string | undefined = undefined;

      try {
        const readyRes = await fetch(`${backendBase}/api/health/ready`);
        if (readyRes.ok) {
          const readyData = await readyRes.json();
          isReady = true;
          dbName = readyData.database?.databaseName;
        }
      } catch {
        isReady = false;
      }

      setBackendHealth({
        isLive,
        isReady,
        statusText: isReady
          ? 'Backend Ready (Atlas Connected)'
          : isLive
          ? 'Backend Live (DB Disconnected)'
          : 'Backend Offline',
        databaseName: dbName,
        checkedAt: new Date().toLocaleTimeString(),
      });
    } catch {
      setBackendHealth({
        isLive: false,
        isReady: false,
        statusText: 'Backend Offline',
        checkedAt: new Date().toLocaleTimeString(),
      });
    }
  };

  useEffect(() => {
    checkSession();
    refreshBackendHealth();
    const interval = setInterval(refreshBackendHealth, 30000);
    return () => clearInterval(interval);
  }, [checkSession]);

  const breadcrumbs: BreadcrumbItem[] = user
    ? [
        { label: user.institutionName },
        { label: user.role.replace('-', ' ').toUpperCase() },
        ...(activeExperimentCode
          ? [{ label: activeExperimentCode, view: 'student-experiment-overview' as AppView }]
          : []),
        { label: currentView.replace(/^[a-z]+-/, '').replace(/-/g, ' ').toUpperCase(), view: currentView },
      ]
    : [];

  return (
    <AppContext.Provider
      value={{
        currentRole,
        currentView,
        user,
        isAuthenticated,
        isLoadingSession,
        activeInstitution,
        activeCourseId,
        activeCourseName,
        activeLabId,
        activeLabName,
        activeSubjectId,
        activeSubjectName,
        activeExperimentId,
        activeExperimentTitle,
        activeExperimentCode,
        activeAttemptId,
        activeSessionId,
        backendHealth,
        breadcrumbs,
        setCurrentView,
        setActiveInstitution,
        setActiveCourseId,
        setActiveLabId,
        setActiveSubjectId,
        setActiveExperimentId,
        setActiveAttemptId,
        setActiveSessionId,
        refreshBackendHealth,
        login,
        logout,
        checkSession,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
