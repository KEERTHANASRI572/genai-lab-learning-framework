import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Network, Users, BookOpen, ArrowRight, RefreshCw, Layers } from 'lucide-react';
import { Card, MetricCard } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { EmptyState } from '../../components/common/EmptyState';
import { useApp } from '../../context/AppContext';
import { getCollegeOverview, CollegeOverviewDto } from '../../services/api';

export const CollegeOverviewView: React.FC = () => {
  const { activeInstitution, setCurrentView } = useApp();
  const [overview, setOverview] = useState<CollegeOverviewDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getCollegeOverview();
      if (res.success && res.data) {
        setOverview(res.data);
      } else {
        setError(res.error?.message || 'Failed to load college overview.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {activeInstitution || 'Institution'} — Administration Portal
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Autonomous college tenant dashboard: manage academic structure, user rosters, approved lab manuals, and analytics.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchOverview}>
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setCurrentView('college-academic-structure')}>
            Manage Academic Structure <ArrowRight size={14} />
          </Button>
        </div>
      </div>

      <Alert type="info">
        <strong>Tenant Isolation Enforced:</strong> All departments, courses, laboratory documents, and student records accessed within this portal belong exclusively to <code>{activeInstitution || 'this institution'}</code>.
      </Alert>

      {error && (
        <Alert type="danger" title="Error Loading Overview">
          {error}
        </Alert>
      )}

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
          Loading institution structure from MongoDB Atlas...
        </div>
      ) : (
        <>
          <div className="grid-4">
            <MetricCard
              title="Academic Departments"
              value={overview ? overview.departmentsCount.toString() : '0'}
              subtitle="Configured academic branches"
              icon={<Network size={20} />}
            />
            <MetricCard
              title="Active Laboratories"
              value={overview ? `${overview.laboratoriesCount} Labs` : '0 Labs'}
              subtitle="Configured under courses"
              icon={<Building2 size={20} />}
            />
            <MetricCard
              title="Enrolled Students"
              value={overview ? overview.enrolledStudentsCount.toString() : '0'}
              subtitle="Active registered learners"
              icon={<Users size={20} />}
            />
            <MetricCard
              title="Approved Lab Manuals"
              value={overview ? `${overview.approvedManualsCount} Documents` : '0 Documents'}
              subtitle="Verified in college RAG store"
              icon={<BookOpen size={20} />}
            />
          </div>

          <div className="grid-2">
            <Card
              title="Academic Hierarchy Overview"
              subtitle="Active 5-level structure"
              headerAction={
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentView('college-academic-structure')}
                >
                  Explore Hierarchy
                </Button>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-accent)' }}>
                    Active Academic Hierarchy:
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    Institution → Department → Course → Laboratory → Experiment
                  </div>
                </div>

                {!overview || overview.departments.length === 0 ? (
                  <EmptyState
                    title="No Departments Configured"
                    description="Get started by configuring your college departments and courses."
                    icon={<Layers size={28} />}
                  />
                ) : (
                  overview.departments.map((dept) => (
                    <div
                      key={dept.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        background: 'rgba(15, 23, 42, 0.4)',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border-subtle)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                          {dept.name} ({dept.code})
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {dept.labsCount} Lab{dept.labsCount !== 1 ? 's' : ''} · {dept.experimentsCount} Experiment{dept.experimentsCount !== 1 ? 's' : ''} · {dept.studentsCount} Student{dept.studentsCount !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <Badge variant={dept.status === 'active' ? 'success' : 'neutral'}>
                        {dept.status || 'Active'}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card
              title="Quick Operations"
              subtitle="Common administrative shortcuts"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    padding: 14,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(15, 23, 42, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onClick={() => setCurrentView('college-users')}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Faculty & Student Management</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Invite faculty members, assign departments and courses, enroll students.
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(15, 23, 42, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onClick={() => setCurrentView('college-resources')}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Verified Learning Resources</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Upload verified lab manuals, apparatus guides, and safety protocols for RAG grounding.
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>

                <div
                  style={{
                    padding: 14,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(15, 23, 42, 0.4)',
                    border: '1px solid var(--border-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                  onClick={() => setCurrentView('college-support')}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>Support & Operational Ledger</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      File technical tickets, track resolution status, and submit support requests.
                    </div>
                  </div>
                  <ArrowRight size={16} style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </div>
  );
};
