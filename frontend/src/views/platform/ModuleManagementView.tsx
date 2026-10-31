import React, { useState } from 'react';
import { Layers, Check, ShieldAlert, Cpu, Sparkles, BookOpen, BarChart3, ToggleLeft, ToggleRight } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';

interface ModuleConfig {
  id: string;
  name: string;
  category: string;
  description: string;
  enabledGlobal: boolean;
  requiresAccreditation: boolean;
  icon: React.ReactNode;
}

export const ModuleManagementView: React.FC = () => {
  const [modules, setModules] = useState<ModuleConfig[]>([
    {
      id: 'mod_rag',
      name: 'RAG Laboratory Resource Indexing',
      category: 'AI Services',
      description: 'Enables dense semantic vector search over approved institution laboratory manuals and protocol PDFs.',
      enabledGlobal: true,
      requiresAccreditation: true,
      icon: <BookOpen size={20} />,
    },
    {
      id: 'mod_tutor',
      name: 'Experiment-Specific AI Learning Assistant',
      category: 'AI Services',
      description: 'Provides grounded real-time tutoring and procedural scaffolding during student laboratory runs.',
      enabledGlobal: true,
      requiresAccreditation: false,
      icon: <Sparkles size={20} />,
    },
    {
      id: 'mod_adaptive',
      name: 'Evidence-Driven Adaptive Learning Engine (Proposed)',
      category: 'Research / Adaptive',
      description: 'Dynamically adapts hints, worked examples, and learning-level presentation based on joint assessment evidence and step context.',
      enabledGlobal: true,
      requiresAccreditation: false,
      icon: <Cpu size={20} />,
    },
    {
      id: 'mod_assessment',
      name: 'Initial Diagnostic & Final Summative Assessments',
      category: 'Assessment',
      description: 'Pre-lab diagnostic level determination and post-lab concept mastery evaluation with automated topic tagging.',
      enabledGlobal: true,
      requiresAccreditation: true,
      icon: <Check size={20} />,
    },
    {
      id: 'mod_escalation',
      name: 'Faculty Help Escalation Bridge',
      category: 'Safety & Governance',
      description: 'Allows students to escalate unresolvable procedural ambiguities or safety queries directly to assigned faculty.',
      enabledGlobal: true,
      requiresAccreditation: true,
      icon: <ShieldAlert size={20} />,
    },
    {
      id: 'mod_analytics',
      name: 'Institutional Learning Analytics & Interventions',
      category: 'Analytics',
      description: 'Identifies recurring procedural errors, student learning gaps, and faculty oversight turnaround times.',
      enabledGlobal: true,
      requiresAccreditation: false,
      icon: <BarChart3 size={20} />,
    },
  ]);

  const toggleModule = (id: string) => {
    setModules(
      modules.map((m) => (m.id === id ? { ...m, enabledGlobal: !m.enabledGlobal } : m))
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Configurable Platform Modules & Institution Types
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Control which functional capabilities are accessible by different institution types and individual college tenants.
        </p>
      </div>

      <Alert type="info" title="Framework Modularity Principle">
        The framework avoids hardcoding rigid institutional assumptions. Different colleges can selectively enable or disable AI assistance, RAG indexing, or assessment engines based on their specific laboratory policies.
      </Alert>

      <div className="grid-2">
        {modules.map((mod) => (
          <Card
            key={mod.id}
            title={mod.name}
            subtitle={mod.category}
            headerAction={
              <button
                onClick={() => toggleModule(mod.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: mod.enabledGlobal ? 'var(--brand-primary)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                aria-label={`Toggle ${mod.name}`}
              >
                {mod.enabledGlobal ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
              </button>
            }
          >
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div
                style={{
                  padding: 10,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(99, 102, 241, 0.1)',
                  color: 'var(--text-accent)',
                }}
              >
                {mod.icon}
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                  {mod.description}
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge variant={mod.enabledGlobal ? 'success' : 'neutral'}>
                    {mod.enabledGlobal ? 'Enabled Across Tenants' : 'Globally Disabled'}
                  </Badge>
                  {mod.requiresAccreditation && (
                    <Badge variant="warning">Accreditation Audit Tracked</Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
};
