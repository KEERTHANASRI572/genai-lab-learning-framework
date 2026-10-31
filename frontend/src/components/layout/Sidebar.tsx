import React from 'react';
import {
  LayoutDashboard,
  Building,
  Layers,
  Activity,
  BarChart3,
  Cpu,
  FileText,
  LifeBuoy,
  Network,
  Users,
  ShieldCheck,
  FolderArchive,
  GraduationCap,
  Sparkles,
  ClipboardCheck,
  CheckCircle2,
  FileQuestion,
  User,
  FlaskConical,
  BookOpen,
  Sliders,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { AppView, UserRole } from '../../types/navigation';

interface SidebarSection {
  title: string;
  items: {
    id: AppView;
    label: string;
    icon: React.ReactNode;
    badge?: string;
  }[];
}

export const Sidebar: React.FC = () => {
  const { currentRole, currentView, setCurrentView } = useApp();

  const getMenuSections = (role: UserRole | null): SidebarSection[] => {
    if (!role) return [];
    switch (role) {
      case 'platform-admin':
        return [
          {
            title: 'Platform Administration',
            items: [
              { id: 'platform-overview', label: 'Platform Overview', icon: <LayoutDashboard size={18} /> },
              { id: 'platform-institutions', label: 'Institution Onboarding', icon: <Building size={18} /> },
              { id: 'platform-modules', label: 'Configurable Modules', icon: <Layers size={18} /> },
              { id: 'platform-activity', label: 'Global Activity', icon: <Activity size={18} /> },
              { id: 'platform-analytics', label: 'Adoption Analytics', icon: <BarChart3 size={18} /> },
            ],
          },
          {
            title: 'Infrastructure & Audits',
            items: [
              { id: 'platform-ai-health', label: 'AI Service & Quotas', icon: <Cpu size={18} /> },
              { id: 'platform-audit-logs', label: 'Audit Trail Ledger', icon: <FileText size={18} /> },
              { id: 'platform-support', label: 'Support & Escalations', icon: <LifeBuoy size={18} /> },
            ],
          },
        ];

      case 'college-admin':
        return [
          {
            title: 'Institutional Governance',
            items: [
              { id: 'college-overview', label: 'College Overview', icon: <LayoutDashboard size={18} /> },
              { id: 'college-academic-structure', label: 'Academic Hierarchy', icon: <Network size={18} /> },
              { id: 'college-users', label: 'Faculty & Students', icon: <Users size={18} /> },
              { id: 'college-roles', label: 'Roles & Status', icon: <ShieldCheck size={18} /> },
            ],
          },
          {
            title: 'Learning & Operations',
            items: [
              { id: 'college-resources', label: 'Institutional Resources', icon: <FolderArchive size={18} /> },
              { id: 'college-analytics', label: 'College Analytics', icon: <BarChart3 size={18} /> },
              { id: 'college-student-progress', label: 'Student Interventions', icon: <GraduationCap size={18} /> },
              { id: 'college-faculty-activity', label: 'Faculty Oversight', icon: <Activity size={18} /> },
              { id: 'college-support', label: 'College Support', icon: <LifeBuoy size={18} /> },
            ],
          },
        ];

      case 'faculty':
        return [
          {
            title: 'Laboratory Curriculum',
            items: [
              { id: 'faculty-dashboard', label: 'Faculty Dashboard', icon: <LayoutDashboard size={18} /> },
              { id: 'faculty-experiments', label: 'Lab & Experiments', icon: <FlaskConical size={18} /> },
              { id: 'faculty-resources', label: 'Approved Resources (RAG)', icon: <BookOpen size={18} /> },
              { id: 'faculty-assessments', label: 'Assessments & Rubrics', icon: <ClipboardCheck size={18} /> },
            ],
          },
          {
            title: 'Student Supervision',
            items: [
              { id: 'faculty-student-progress', label: 'Student Progress', icon: <GraduationCap size={18} /> },
              { id: 'faculty-learning-gaps', label: 'Learning Gaps & Errors', icon: <FileQuestion size={18} /> },
              { id: 'faculty-help-requests', label: 'AI Help Escalations', icon: <LifeBuoy size={18} /> },
              { id: 'faculty-analytics', label: 'Assessment Performance', icon: <BarChart3 size={18} /> },
            ],
          },
        ];

      case 'student':
        return [
          {
            title: 'Personalized Lab Journey',
            items: [
              { id: 'student-dashboard', label: 'Student Dashboard', icon: <LayoutDashboard size={18} /> },
              { id: 'student-experiments', label: 'Experiment Catalog', icon: <FlaskConical size={18} /> },
              { id: 'student-experiment-overview', label: 'Experiment Overview & Safety', icon: <BookOpen size={18} /> },
              { id: 'student-initial-assessment', label: '1. Initial Diagnostic', icon: <ClipboardCheck size={18} /> },
              { id: 'student-learning-level', label: '2. Dynamic Level Engine', icon: <Sliders size={18} /> },
              { id: 'student-workspace', label: '3. Interactive Lab & AI', icon: <Sparkles size={18} /> },
              { id: 'student-final-assessment', label: '4. Final Assessment', icon: <CheckCircle2 size={18} /> },
            ],
          },
          {
            title: 'Records & Assistance',
            items: [
              { id: 'student-profile', label: 'Learner Skill Profile', icon: <User size={18} /> },
              { id: 'student-support', label: 'Help Requests & Tickets', icon: <LifeBuoy size={18} /> },
            ],
          },
        ];
    }
  };

  const sections = getMenuSections(currentRole);

  return (
    <aside
      style={{
        width: 'var(--sidebar-width)',
        backgroundColor: '#0a0f1d',
        borderRight: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        zIndex: 60,
      }}
    >
      <div
        style={{
          height: 'var(--header-height)',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 'var(--radius-sm)',
            background: 'var(--brand-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
          }}
        >
          <Cpu size={18} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            GenAI Lab Framework
          </div>
          <div style={{ fontSize: '0.675rem', color: 'var(--text-muted)' }}>
            Multi-Tenant Educational OS
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 12px' }}>
        {sections.map((section, sIdx) => (
          <div key={sIdx} style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: '0.675rem',
                fontWeight: 700,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                padding: '0 10px',
                marginBottom: 8,
              }}
            >
              {section.title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {section.items.map((item) => {
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentView(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: isActive ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
                      border: isActive ? '1px solid var(--border-accent)' : '1px solid transparent',
                      fontWeight: isActive ? 600 : 400,
                      fontSize: '0.825rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ color: isActive ? 'var(--brand-primary)' : 'inherit', opacity: isActive ? 1 : 0.7 }}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span
                        style={{
                          fontSize: '0.65rem',
                          padding: '1px 6px',
                          borderRadius: 'var(--radius-full)',
                          background: 'var(--brand-primary)',
                          color: '#fff',
                        }}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(15, 23, 42, 0.4)',
        }}
      >
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Active Framework Mode:
        </div>
        <div style={{ fontSize: '0.775rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'capitalize' }}>
          {currentRole ? `${currentRole.replace('-', ' ')} Portal` : 'Session Required'}
        </div>
      </div>
    </aside>
  );
};
