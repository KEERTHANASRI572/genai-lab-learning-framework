import React, { useState, useEffect, useCallback } from 'react';
import { FlaskConical, Plus, Save, AlertTriangle, CheckCircle2, Trash2, RefreshCw, Send } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Tabs } from '../../components/common/Tabs';
import { FormField } from '../../components/common/FormField';
import { Alert } from '../../components/common/Alert';
import {
  getExperiments,
  getLaboratories,
  createExperiment,
  updateExperiment,
  publishExperiment,
  deleteExperiment,
  deleteExperimentPermanently,
  ExperimentDto,
  LaboratoryDto,
} from '../../services/api';

export const ExperimentAuthoringView: React.FC = () => {
  const [activeTab, setActiveTab] = useState('metadata');
  const [experiments, setExperiments] = useState<ExperimentDto[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratoryDto[]>([]);
  const [selectedExpId, setSelectedExpId] = useState<string>('new');
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [expTitle, setExpTitle] = useState('RC Circuit Transient Response & Time Constant');
  const [expCode, setExpCode] = useState('EXP-ECE-204L-01');
  const [laboratoryId, setLaboratoryId] = useState('');
  const [duration, setDuration] = useState('90');
  const [expStatus, setExpStatus] = useState<'draft' | 'under_review' | 'published' | 'archived'>('draft');

  const [objectives, setObjectives] = useState<string[]>([
    'Measure the charging and discharging voltage curves of an RC circuit using a digital oscilloscope.',
    'Experimentally calculate the circuit time constant (τ = R × C) and compare with theoretical predictions.',
    'Observe the effect of varying capacitance and resistance values on the transient response slope.',
  ]);

  const [equipment, setEquipment] = useState<string[]>([
    'Digital Storage Oscilloscope (DSO 100MHz)',
    'Function / Arbitrary Waveform Generator (10Vpp Square Wave, 1kHz)',
    'Precision Decade Resistance Box (1kΩ – 100kΩ)',
    'Standard Capacitor Assortment (0.01μF, 0.1μF, 1.0μF)',
    'Breadboard & BNC-to-Alligator Probes',
  ]);

  const [safetyInstructions, setSafetyInstructions] = useState<string[]>([
    'De-energize the function generator before adjusting decade resistance box connections.',
    'Ensure oscilloscope probe ground clips are connected strictly to the common circuit ground.',
    'Discharge electrolytic capacitors manually with a 10kΩ resistor before component replacement.',
  ]);

  const [steps, setSteps] = useState([
    {
      stepNumber: 1,
      title: 'Circuit Schematic Setup',
      instruction: 'Assemble the series RC circuit on the breadboard. Connect a 10kΩ resistor in series with a 0.1μF ceramic capacitor.',
      safetyCheckRequired: true,
      expectedObservation: 'Series loop confirmed with zero loose pin connections. Circuit impedance verified with DMM.',
    },
    {
      stepNumber: 2,
      title: 'Function Generator Configuration',
      instruction: 'Set the function generator to produce a 10V peak-to-peak square wave at a frequency of 1 kHz with zero DC offset.',
      safetyCheckRequired: false,
      expectedObservation: 'Symmetric square wave observed on Channel 1 of the oscilloscope with 50% duty cycle.',
    },
    {
      stepNumber: 3,
      title: 'Transient Voltage Measurement',
      instruction: 'Connect Channel 2 of the DSO across the capacitor. Trigger on the rising edge to capture the charging curve.',
      safetyCheckRequired: false,
      expectedObservation: 'Exponential rising curve reaching 63.2% of Vmax at t = τ (approximately 1.0 ms).',
    },
  ]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [expRes, labRes] = await Promise.all([
        getExperiments(),
        getLaboratories(),
      ]);

      if (expRes.success && expRes.data) {
        setExperiments(expRes.data);
        if (expRes.data.length > 0 && selectedExpId === 'new') {
          // Select first existing experiment if any
          const first = expRes.data[0];
          populateFormWith(first);
        }
      }

      if (labRes.success && labRes.data) {
        setLaboratories(labRes.data);
        if (!laboratoryId && labRes.data.length > 0) {
          setLaboratoryId(labRes.data[0]._id);
        }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to query experiments';
      setError(`NETWORK_ERROR: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [selectedExpId, laboratoryId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const populateFormWith = (exp: ExperimentDto) => {
    setSelectedExpId(exp._id);
    setExpTitle(exp.title);
    setExpCode(exp.code);
    setLaboratoryId(exp.laboratoryId);
    setDuration(exp.estimatedDurationMins ? String(exp.estimatedDurationMins) : '90');
    setExpStatus(exp.status);
    if (exp.objectives && exp.objectives.length > 0) setObjectives(exp.objectives);
    if (exp.equipment && exp.equipment.length > 0) setEquipment(exp.equipment);
    if (exp.safetyInstructions && exp.safetyInstructions.length > 0) setSafetyInstructions(exp.safetyInstructions);
    if (exp.procedureSteps && exp.procedureSteps.length > 0) {
      setSteps(
        exp.procedureSteps.map((s, idx) => ({
          stepNumber: s.stepNumber || idx + 1,
          title: s.title,
          instruction: s.instruction || s.instructions || '',
          safetyCheckRequired: Boolean(s.safetyCheckRequired),
          expectedObservation: s.expectedObservation || s.expectedOutcome || '',
        }))
      );
    }
  };

  const handleCreateNew = () => {
    setSelectedExpId('new');
    setExpTitle('New Laboratory Experiment');
    setExpCode(`EXP-${Date.now().toString().slice(-4)}`);
    setDuration('60');
    setExpStatus('draft');
    setObjectives(['Identify experiment objectives']);
    setEquipment(['Basic benchtop multimeter']);
    setSafetyInstructions(['Follow standard laboratory eye and circuit protection.']);
    setSteps([
      {
        stepNumber: 1,
        title: 'Initial Apparatus Alignment',
        instruction: 'Calibrate instrument zero point before powering on.',
        safetyCheckRequired: true,
        expectedObservation: 'Display shows 0.00 offset.',
      },
    ]);
  };

  const handleSaveDraft = async () => {
    if (!laboratoryId) {
      setError('Please select an authorized laboratory container.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const payload = {
      title: expTitle.trim(),
      code: expCode.trim().toUpperCase(),
      laboratoryId,
      estimatedDurationMins: Number(duration) || 90,
      objectives: objectives.filter((o) => o.trim()),
      equipment: equipment.filter((e) => e.trim()),
      safetyInstructions: safetyInstructions.filter((s) => s.trim()),
      procedureSteps: steps.map((s) => ({
        stepNumber: s.stepNumber,
        title: s.title,
        instruction: s.instruction,
        safetyCheckRequired: s.safetyCheckRequired,
        expectedObservation: s.expectedObservation,
      })),
      status: expStatus,
    };

    let res;
    if (selectedExpId === 'new') {
      res = await createExperiment(payload);
    } else {
      res = await updateExperiment(selectedExpId, payload);
    }

    setSaving(false);

    if (res.success && res.data) {
      setNotice(`Experiment "${res.data.title}" saved successfully to database.`);
      setSelectedExpId(res.data._id);
      loadData();
    } else {
      setError(res.error?.message || 'Failed to save experiment.');
    }
  };

  const handlePublish = async () => {
    if (selectedExpId === 'new') {
      setError('Please save the experiment draft before publishing.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const res = await publishExperiment(selectedExpId);
    setSaving(false);

    if (res.success && res.data) {
      setExpStatus('published');
      setNotice(`Experiment "${res.data.title}" published! Students can now access this experiment.`);
      loadData();
    } else {
      setError(res.error?.message || 'Failed to publish experiment.');
    }
  };

  const handleReactivate = async () => {
    if (selectedExpId === 'new') return;
    setSaving(true);
    setError(null);
    setNotice(null);

    const res = await updateExperiment(selectedExpId, { status: 'draft' });
    setSaving(false);

    if (res.success && res.data) {
      setExpStatus('draft');
      setNotice(`Experiment restored to draft status.`);
      loadData();
    } else {
      setError(res.error?.message || 'Failed to reactivate experiment.');
    }
  };

  const handleDelete = async () => {
    if (selectedExpId === 'new') return;
    if (!window.confirm(`Archive experiment "${expTitle}" (${expCode})? It will be marked as archived while historical student attempts remain intact.`)) return;

    setSaving(true);
    setError(null);
    setNotice(null);

    const res = await deleteExperiment(selectedExpId);
    setSaving(false);

    if (res.success) {
      setNotice(`Experiment archived successfully.`);
      setExpStatus('archived');
      loadData();
    } else {
      setError(res.error?.message || 'Failed to archive experiment.');
    }
  };

  const handlePermanentDelete = async () => {
    if (selectedExpId === 'new') return;
    if (
      !window.confirm(
        `PERMANENT DELETE: Are you sure you want to permanently delete experiment "${expTitle}" (${expCode})?\n\nThis action cannot be undone and requires zero existing student sessions or assessments.`
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    const res = await deleteExperimentPermanently(selectedExpId);
    setSaving(false);

    if (res.success) {
      setNotice(`Experiment "${expTitle}" permanently deleted from database.`);
      handleCreateNew();
      loadData();
    } else {
      const errDetails = res.error?.details as { assessments?: number; learningSessions?: number; helpRequests?: number } | undefined;
      if (res.error?.code === 'DEPENDENT_RESOURCES_EXIST' && errDetails) {
        setError(
          `Cannot permanently delete: ${res.error.message} (Sessions: ${errDetails.learningSessions || 0}, Assessments: ${errDetails.assessments || 0}, Help Requests: ${errDetails.helpRequests || 0}). Use Archive instead to preserve historical records.`
        );
      } else {
        setError(res.error?.message || 'Failed to permanently delete experiment.');
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Experiment Protocol &amp; Safety Authoring
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Author, edit, publish, and govern laboratory protocols, apparatus, and non-negotiable safety rules.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Button variant="outline" icon={<Plus size={16} />} onClick={handleCreateNew}>
            New Experiment
          </Button>
          {selectedExpId !== 'new' && (
            <>
              {expStatus === 'archived' ? (
                <Button variant="outline" icon={<CheckCircle2 size={16} />} onClick={handleReactivate} disabled={saving}>
                  Reactivate
                </Button>
              ) : (
                <Button variant="ghost" icon={<AlertTriangle size={16} />} onClick={handleDelete} disabled={saving}>
                  Archive
                </Button>
              )}
              <Button
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={handlePermanentDelete}
                disabled={saving}
                title="Permanently delete experiment from database"
              >
                Delete
              </Button>
            </>
          )}
          <Button variant="outline" icon={<Save size={16} />} onClick={handleSaveDraft} disabled={saving}>
            {selectedExpId === 'new' ? 'Save Draft' : 'Save Changes'}
          </Button>
          {expStatus !== 'published' && (
            <Button variant="primary" icon={<Send size={16} />} onClick={handlePublish} disabled={saving}>
              Publish Experiment
            </Button>
          )}
        </div>
      </div>

      {/* Experiment Selector Bar */}
      <div
        className="glass-panel"
        style={{
          padding: '12px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <FlaskConical size={18} style={{ color: 'var(--brand-primary)' }} />
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active Experiment:</span>
          <select
            className="form-select"
            value={selectedExpId}
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'new') {
                handleCreateNew();
              } else {
                const found = experiments.find((exp) => exp._id === val);
                if (found) populateFormWith(found);
              }
            }}
            style={{ minWidth: 260 }}
          >
            <option value="new">+ Create New Experiment</option>
            {experiments.map((exp) => (
              <option key={exp._id} value={exp._id}>
                [{exp.code}] {exp.title} ({exp.status})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Status:</span>
          {expStatus === 'published' && <Badge variant="success" dot>Published</Badge>}
          {expStatus === 'draft' && <Badge variant="warning" dot>Draft</Badge>}
          {expStatus === 'under_review' && <Badge variant="brand" dot>Under Review</Badge>}
          {expStatus === 'archived' && <Badge variant="danger" dot>Archived</Badge>}
        </div>
      </div>

      {notice && (
        <Alert type="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error && (
        <Alert type="danger" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Tabs
        tabs={[
          { id: 'metadata', label: '1. Overview & Objectives' },
          { id: 'equipment', label: '2. Apparatus & Safety Gates' },
          { id: 'procedures', label: '3. Step-by-Step Procedures' },
        ]}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {activeTab === 'metadata' && (
        <Card title="Experiment Identifiers &amp; Objectives">
          <div className="grid-2">
            <FormField label="Experiment Title" required>
              <input
                type="text"
                className="form-input"
                value={expTitle}
                onChange={(e) => setExpTitle(e.target.value)}
              />
            </FormField>
            <FormField label="Experiment Code" required>
              <input
                type="text"
                className="form-input"
                value={expCode}
                onChange={(e) => setExpCode(e.target.value.toUpperCase())}
              />
            </FormField>
          </div>

          <div className="grid-2">
            <FormField label="Assigned Laboratory" required>
              <select
                className="form-select"
                value={laboratoryId}
                onChange={(e) => setLaboratoryId(e.target.value)}
              >
                {laboratories.length === 0 && <option value="">No laboratories available</option>}
                {laboratories.map((lab) => (
                  <option key={lab._id} value={lab._id}>
                    {lab.name} ({lab.code})
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Estimated Duration (Minutes)" required>
              <input
                type="number"
                className="form-input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </FormField>
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Learning Objectives:</span>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setObjectives([...objectives, ''])}
              >
                Add Objective
              </Button>
            </div>
            {objectives.map((obj, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>{i + 1}.</span>
                <input
                  type="text"
                  className="form-input"
                  value={obj}
                  onChange={(e) => {
                    const updated = [...objectives];
                    updated[i] = e.target.value;
                    setObjectives(updated);
                  }}
                />
                {objectives.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => setObjectives(objectives.filter((_, idx) => idx !== i))}
                  />
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {activeTab === 'equipment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Card title="Required Apparatus &amp; Equipment Checklist">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', margin: 0 }}>
                Students must verify the presence and operational condition of each apparatus item.
              </p>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setEquipment([...equipment, ''])}
              >
                Add Apparatus
              </Button>
            </div>
            {equipment.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>•</span>
                <input
                  type="text"
                  className="form-input"
                  value={item}
                  onChange={(e) => {
                    const updated = [...equipment];
                    updated[i] = e.target.value;
                    setEquipment(updated);
                  }}
                />
                {equipment.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => setEquipment(equipment.filter((_, idx) => idx !== i))}
                  />
                )}
              </div>
            ))}
          </Card>

          <Card title="Mandatory Safety Instructions &amp; Voltage / Chemical Hazards">
            <Alert type="warning">
              Safety rules authored here are non-negotiable safety gates. AI assistance will never suggest shortcuts bypassing these instructions.
            </Alert>
            <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0' }}>
              <Button
                variant="ghost"
                size="sm"
                icon={<Plus size={14} />}
                onClick={() => setSafetyInstructions([...safetyInstructions, ''])}
              >
                Add Safety Rule
              </Button>
            </div>
            {safetyInstructions.map((inst, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <AlertTriangle size={18} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                <input
                  type="text"
                  className="form-input"
                  value={inst}
                  onChange={(e) => {
                    const updated = [...safetyInstructions];
                    updated[i] = e.target.value;
                    setSafetyInstructions(updated);
                  }}
                />
                {safetyInstructions.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 size={14} />}
                    onClick={() => setSafetyInstructions(safetyInstructions.filter((_, idx) => idx !== i))}
                  />
                )}
              </div>
            ))}
          </Card>
        </div>
      )}

      {activeTab === 'procedures' && (
        <Card title="Step-by-Step Procedural Workflow">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
              Each step is presented interactively during student laboratory practice.
            </p>
            <Button
              variant="outline"
              size="sm"
              icon={<Plus size={14} />}
              onClick={() =>
                setSteps([
                  ...steps,
                  {
                    stepNumber: steps.length + 1,
                    title: `Step ${steps.length + 1}`,
                    instruction: '',
                    safetyCheckRequired: false,
                    expectedObservation: '',
                  },
                ])
              }
            >
              Add Step
            </Button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {steps.map((step, idx) => (
              <div
                key={idx}
                style={{
                  padding: 16,
                  borderRadius: 'var(--radius-sm)',
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid var(--border-subtle)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <input
                    type="text"
                    className="form-input"
                    value={step.title}
                    style={{ fontWeight: 700, width: '60%' }}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[idx] = { ...step, title: e.target.value };
                      setSteps(updated);
                    }}
                  />
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <Badge variant="brand">Step {step.stepNumber}</Badge>
                    {steps.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 size={14} />}
                        onClick={() =>
                          setSteps(
                            steps
                              .filter((_, i) => i !== idx)
                              .map((s, i) => ({ ...s, stepNumber: i + 1 }))
                          )
                        }
                      />
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Instruction:</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={step.instruction}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[idx] = { ...step, instruction: e.target.value };
                      setSteps(updated);
                    }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Expected Observation:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={step.expectedObservation}
                    onChange={(e) => {
                      const updated = [...steps];
                      updated[idx] = { ...step, expectedObservation: e.target.value };
                      setSteps(updated);
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
