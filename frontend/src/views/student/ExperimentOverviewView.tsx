import React, { useEffect, useState } from 'react';
import { BookOpen, CheckSquare, AlertTriangle, ArrowRight, ShieldCheck, Wrench, ListOrdered, Loader2, ChevronRight } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { useApp } from '../../context/AppContext';
import { getExperimentById, getExperiments, ExperimentDto } from '../../services/api';

export const ExperimentOverviewView: React.FC = () => {
  const { setCurrentView, activeExperimentId, setActiveExperimentId } = useApp();
  const [experiment, setExperiment] = useState<ExperimentDto | null>(null);
  const [availableExperiments, setAvailableExperiments] = useState<ExperimentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [safetyAcknowledged, setSafetyAcknowledged] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setIsLoading(true);
      setError(null);
      let expId = activeExperimentId;

      // Fetch published experiments
      const listRes = await getExperiments({ status: 'published' });
      if (mounted && listRes.success && listRes.data) {
        setAvailableExperiments(listRes.data);
        if (!expId && listRes.data.length > 0) {
          expId = listRes.data[0]._id;
          setActiveExperimentId(expId, listRes.data[0].title, listRes.data[0].code);
        }
      }

      if (!expId) {
        if (mounted) {
          setError('No experiment selected. Please choose an experiment from the catalog.');
          setIsLoading(false);
        }
        return;
      }

      const res = await getExperimentById(expId);
      if (!mounted) return;
      if (res.success && res.data) {
        setExperiment(res.data);
      } else {
        setError(res.error?.message || 'Failed to load experiment specifications from MongoDB.');
      }
      setIsLoading(false);
    }
    load();
    return () => {
      mounted = false;
    };
  }, [activeExperimentId, setActiveExperimentId]);

  const handleExperimentChange = async (newId: string) => {
    const found = availableExperiments.find((e) => e._id === newId);
    if (found) {
      setActiveExperimentId(found._id, found.title, found.code);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', justifyContent: 'center' }}>
          <Loader2 className="animate-spin" size={24} style={{ color: 'var(--brand-primary)' }} />
          <span style={{ color: 'var(--text-secondary)' }}>Loading laboratory experiment specifications from MongoDB Atlas...</span>
        </div>
      </Card>
    );
  }

  if (error || !experiment) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Alert type="danger" title="Experiment Unavailable">
          {error || 'Experiment specifications could not be loaded.'}
        </Alert>

        {availableExperiments.length > 0 && (
          <Card title="Available Experiments">
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Select an authorized experiment from your curriculum:
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {availableExperiments.map((e) => (
                <Button
                  key={e._id}
                  variant="outline"
                  size="sm"
                  onClick={() => handleExperimentChange(e._id)}
                >
                  {e.code}: {e.title}
                </Button>
              ))}
            </div>
          </Card>
        )}

        <Button variant="outline" onClick={() => setCurrentView('student-experiments')}>
          Back to Catalog
        </Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Switch Experiment Bar if multiple available */}
      {availableExperiments.length > 1 && (
        <div
          className="glass-panel"
          style={{
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Switch Active Experiment:
          </span>
          <select
            className="form-select"
            style={{ maxWidth: 360, fontSize: '0.85rem' }}
            value={experiment._id}
            onChange={(e) => handleExperimentChange(e.target.value)}
          >
            {availableExperiments.map((e) => (
              <option key={e._id} value={e._id}>
                {e.code} — {e.title}
              </option>
            ))}
          </select>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Badge variant="brand">{experiment.code}</Badge>
            <span style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
              Estimated Duration: {experiment.estimatedDurationMins || 90} mins
            </span>
          </div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {experiment.title}
          </h1>
          {experiment.description && (
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: 4, maxWidth: 700 }}>
              {experiment.description}
            </p>
          )}
        </div>
        <Button
          variant="primary"
          size="lg"
          disabled={!safetyAcknowledged}
          icon={<ArrowRight size={16} />}
          onClick={() => setCurrentView('student-initial-assessment')}
        >
          Begin Initial Diagnostic
        </Button>
      </div>

      {!safetyAcknowledged && (
        <Alert type="warning" title="Mandatory Safety Acknowledgment Required">
          Please review the laboratory safety guidelines and check the confirmation box below to unlock the diagnostic assessment.
        </Alert>
      )}

      {/* Pedagogical Learning Objectives */}
      <Card title="Pedagogical Learning Objectives" subtitle="Expected conceptual & observational milestones">
        {experiment.objectives && experiment.objectives.length > 0 ? (
          <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            {experiment.objectives.map((obj, i) => (
              <li key={i}>{obj}</li>
            ))}
          </ul>
        ) : (
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No specific learning objectives configured for this experiment.
          </p>
        )}
      </Card>

      <div className="grid-2">
        {/* Equipment Checklist */}
        <Card title="Required Apparatus & Bench Checklist" subtitle="Confirm availability before experiment run">
          {experiment.equipment && experiment.equipment.length > 0 ? (
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {experiment.equipment.map((eq, i) => (
                <li key={i}>{eq}</li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No specialized equipment specified. Standard laboratory bench apparatus applies.
            </p>
          )}
        </Card>

        {/* Prerequisites */}
        <Card title="Prerequisite Concepts" subtitle="Foundational knowledge evaluated in initial test">
          {experiment.prerequisites && experiment.prerequisites.length > 0 ? (
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {experiment.prerequisites.map((pre, i) => (
                <li key={i}>{pre}</li>
              ))}
            </ul>
          ) : (
            <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No prerequisite concepts recorded for this experiment.
            </p>
          )}
        </Card>
      </div>

      {/* Safety Instructions */}
      <Card
        title="Mandatory Laboratory Safety Rules & Hazard Warnings"
        subtitle="Institution-approved safety protocols strictly enforced by the platform"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {experiment.safetyInstructions && experiment.safetyInstructions.length > 0 ? (
            experiment.safetyInstructions.map((rule, i) => (
              <div
                key={i}
                style={{
                  padding: 12,
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--warning-bg)',
                  border: '1px solid var(--warning-border)',
                  color: '#fcd34d',
                  fontSize: '0.875rem',
                }}
              >
                <strong>Safety Protocol {i + 1}:</strong> {rule}
              </div>
            ))
          ) : (
            <div
              style={{
                padding: 12,
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(15, 23, 42, 0.5)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
                fontSize: '0.875rem',
              }}
            >
              Follow standard laboratory safety guidelines and departmental operating procedures.
            </div>
          )}
        </div>

        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <input
            type="checkbox"
            id="safetyAck"
            checked={safetyAcknowledged}
            onChange={(e) => setSafetyAcknowledged(e.target.checked)}
            style={{ width: 18, height: 18, cursor: 'pointer' }}
          />
          <label
            htmlFor="safetyAck"
            style={{ fontSize: '0.875rem', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500 }}
          >
            I have read and agree to strictly comply with all laboratory apparatus safety protocols and bench handling rules.
          </label>
        </div>
      </Card>
    </div>
  );
};
