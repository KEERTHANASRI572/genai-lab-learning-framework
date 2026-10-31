import React, { useState, useEffect, useCallback } from 'react';
import { GraduationCap, Award, BookOpen, Clock, CheckCircle, RefreshCw } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { EmptyState } from '../../components/common/EmptyState';
import { useApp } from '../../context/AppContext';
import { getFacultyOversight, FacultyOversightDto } from '../../services/api';

export const FacultyParticipationView: React.FC = () => {
  const { setCurrentView } = useApp();
  const [faculty, setFaculty] = useState<FacultyOversightDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFaculty = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getFacultyOversight();
      if (res.success && res.data) {
        setFaculty(res.data);
      } else {
        setError(res.error?.message || 'Failed to load faculty participation data.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFaculty();
  }, [fetchFaculty]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Faculty Participation & Resource Contributions
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Monitor genuine faculty engagement in laboratory authoring, verified RAG manual curation, and student escalation resolution.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchFaculty}>
            Refresh
          </Button>
          <Button variant="primary" onClick={() => setCurrentView('college-users')}>
            Manage Faculty Roster
          </Button>
        </div>
      </div>

      {error && (
        <Alert type="danger" title="Error Loading Faculty Oversight">
          {error}
        </Alert>
      )}

      <Card padding={false}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Querying faculty records and contribution ledger from MongoDB Atlas...
          </div>
        ) : faculty.length === 0 ? (
          <EmptyState
            title="No Faculty Members Enrolled"
            description="No faculty accounts have been created for this institution yet. Use the 'Manage Faculty Roster' button to invite department instructors."
            icon={<GraduationCap size={36} />}
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Faculty Member</th>
                  <th>Department</th>
                  <th>Authored Experiments</th>
                  <th>Approved Lab Resources</th>
                  <th>Escalations Resolved</th>
                  <th>Turnaround Status</th>
                </tr>
              </thead>
              <tbody>
                {faculty.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 600 }}>{f.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {f.email}
                        </div>
                      </div>
                    </td>
                    <td>
                      <strong>{f.dept}</strong>
                    </td>
                    <td>
                      <Badge variant={f.authoredLabs > 0 ? 'brand' : 'neutral'}>
                        {f.authoredLabs} Experiment{f.authoredLabs !== 1 ? 's' : ''}
                      </Badge>
                    </td>
                    <td>
                      <Badge variant={f.approvedDocs > 0 ? 'brand' : 'neutral'}>
                        {f.approvedDocs} Document{f.approvedDocs !== 1 ? 's' : ''}
                      </Badge>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 600,
                          color: f.escalationsAnswered > 0 ? 'var(--success)' : 'var(--text-muted)',
                        }}
                      >
                        {f.escalationsAnswered} Resolved
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {f.avgResponseTime}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
