import React from 'react';
import { FlaskConical, BookOpen, CheckCircle, ArrowRight, Clock, Award, Sparkles } from 'lucide-react';
import { Card, MetricCard } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { useApp } from '../../context/AppContext';

export const StudentDashboardView: React.FC = () => {
  const { user, setCurrentView, activeLabName, activeSubjectName, activeCourseName } = useApp();

  if (!user) return null;

  const currentLabDisplay = activeLabName || activeSubjectName;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Welcome Hero Banner */}
      <div
        className="glass-panel"
        style={{
          padding: '24px 28px',
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
          borderLeft: '4px solid var(--brand-primary)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-accent)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Personalized Laboratory Learning Environment
          </span>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: 4 }}>
            Welcome back, {user.name}
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Active Laboratory:{' '}
            <strong>
              {currentLabDisplay ? `${currentLabDisplay} (${activeCourseName || 'Selected Course'})` : 'No Laboratory Selected Yet'}
            </strong>
          </p>
        </div>
        <Button
          variant="primary"
          size="lg"
          icon={<FlaskConical size={18} />}
          onClick={() => setCurrentView('student-experiments')}
        >
          {currentLabDisplay ? 'Browse Laboratory Experiments' : 'Select Course & Laboratory'} <ArrowRight size={16} />
        </Button>
      </div>

      {/* Metric Vitals */}
      <div className="grid-4">
        <MetricCard
          title="Active Laboratory"
          value={currentLabDisplay ? currentLabDisplay.split(':')[0] : 'Not Selected'}
          subtitle={activeCourseName || 'Choose from catalog'}
          icon={<BookOpen size={20} />}
        />
        <MetricCard
          title="Diagnostic Assessment"
          value="Adaptive"
          subtitle="Pre-lab concept evaluation"
          icon={<Award size={20} />}
        />
        <MetricCard
          title="Training Scaffolding"
          value="Basic · Inter · Adv"
          subtitle="Dynamically adjusted tier"
          icon={<CheckCircle size={20} />}
        />
        <MetricCard
          title="AI Grounded Assistance"
          value="Active"
          subtitle="Strict manual grounding"
          icon={<Sparkles size={20} />}
        />
      </div>

      {/* Guided Journey Roadmap Card */}
      <Card
        title="Personalized Learning Workflow"
        subtitle="Step-by-step educational journey configured for each laboratory experiment"
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            marginTop: 8,
          }}
        >
          {[
            { step: '1', title: 'Course & Laboratory', desc: 'Select program & lab', view: 'student-experiments' as const },
            { step: '2', title: 'Overview & Safety', desc: 'Review objectives & rules', view: 'student-experiment-overview' as const },
            { step: '3', title: 'Initial Diagnostic', desc: 'Pre-lab concept check', view: 'student-initial-assessment' as const },
            { step: '4', title: 'Adaptive Level', desc: 'Topic-specific proficiency', view: 'student-learning-level' as const },
            { step: '5', title: 'Lab & AI Tutor', desc: 'Guided practice & RAG', view: 'student-workspace' as const },
            { step: '6', title: 'Final Assessment', desc: 'Evaluate mastery & gaps', view: 'student-final-assessment' as const },
            { step: '7', title: 'Learner Profile', desc: 'Dynamic skill trajectory', view: 'student-profile' as const },
          ].map((item, idx) => (
            <div
              key={idx}
              onClick={() => setCurrentView(item.view)}
              className="glass-panel"
              style={{
                padding: '14px',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    background: 'var(--brand-primary)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                  }}
                >
                  {item.step}
                </span>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-accent)' }}>Explore →</span>
              </div>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)', marginTop: 4 }}>
                {item.title}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {item.desc}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};
