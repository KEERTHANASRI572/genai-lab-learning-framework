import React from 'react';
import { Cpu, Zap, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';
import { Card, MetricCard } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { useApp } from '../../context/AppContext';

export const AIServiceHealthView: React.FC = () => {
  const { backendHealth, refreshBackendHealth } = useApp();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            AI Service Health, Resource Quotas & Error Telemetry
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Monitor server-side LLM provider adapters, vector database retrieval latency, token budgets, and safety guardrails.
          </p>
        </div>
        <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={refreshBackendHealth}>
          Refresh Gateway Vitals
        </Button>
      </div>

      <div className="grid-4">
        <MetricCard
          title="Server-Side LLM Gateway"
          value={backendHealth.isLive ? 'Online' : 'Standby'}
          subtitle="Provider-agnostic adapter"
          icon={<Cpu size={20} />}
        />
        <MetricCard
          title="Vector Retrieval Latency"
          value="< 45ms"
          subtitle="Target P95 vector match"
          icon={<Zap size={20} />}
        />
        <MetricCard
          title="Token Quota Consumed"
          value="0 / 10M"
          subtitle="Tokens (Awaiting Phase 5)"
          icon={<Zap size={20} />}
        />
        <MetricCard
          title="Safety Filter Violations"
          value="0"
          subtitle="Zero safety breaches"
          icon={<ShieldCheck size={20} />}
        />
      </div>

      <Card
        title="Configured AI Gateway Providers"
        subtitle="Provider configuration managed strictly server-side with zero client API key exposure"
      >
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Service / Adapter</th>
                <th>Role in Framework</th>
                <th>Target Provider</th>
                <th>Status</th>
                <th>Token Allocation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Laboratory Tutoring LLM</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Interactive contextual guidance during experiment steps</div>
                </td>
                <td>Student Scaffolding</td>
                <td>Claude 3.5 / Gemini 1.5 Pro (Configurable)</td>
                <td><Badge variant="brand">Awaiting Phase 5 Selection</Badge></td>
                <td>2,000,000 tokens / mo / inst</td>
              </tr>
              <tr>
                <td>
                  <strong>Laboratory Protocol RAG Embeddings</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Text-embedding vector indexing of approved lab manuals</div>
                </td>
                <td>Knowledge Base Grounding</td>
                <td>Atlas Vector Search / text-embedding-004</td>
                <td><Badge variant="info">Planned Phase 4</Badge></td>
                <td>50,000 document chunks</td>
              </tr>
              <tr>
                <td>
                  <strong>Safety & Guardrail Classifier</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Detects hazardous step deviations or prompt injection</div>
                </td>
                <td>Safety Compliance</td>
                <td>Rule-based + Semantic Validator</td>
                <td><Badge variant="warning">Enforced Server-Side</Badge></td>
                <td>Unrestricted</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Alert type="warning" title="Safety-Critical Instruction Rule">
        AI responses must never override verified laboratory safety procedures or chemical hazard guidelines. If a student attempts an unsafe physical step or the AI retrieval model exhibits high uncertainty, the system triggers the <strong>Faculty Escalation Bridge</strong> instead of generating speculative instructions.
      </Alert>
    </div>
  );
};
