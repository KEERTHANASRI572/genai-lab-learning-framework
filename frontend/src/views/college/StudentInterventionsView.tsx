import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Search, RefreshCw, UserCheck } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Pagination } from '../../components/common/Pagination';
import { Alert } from '../../components/common/Alert';
import { EmptyState } from '../../components/common/EmptyState';
import { getStudentInterventions, StudentInterventionDto } from '../../services/api';

export const StudentInterventionsView: React.FC = () => {
  const [interventions, setInterventions] = useState<StudentInterventionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const fetchInterventions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getStudentInterventions();
      if (res.success && res.data) {
        setInterventions(res.data);
      } else {
        setError(res.error?.message || 'Failed to load student interventions.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterventions();
  }, [fetchInterventions]);

  const filtered = interventions.filter(
    (item) =>
      item.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.currentExperiment.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.department.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
  const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Badge variant="danger">High Priority</Badge>;
      case 'medium':
        return <Badge variant="warning">Medium</Badge>;
      default:
        return <Badge variant="info">Low</Badge>;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Student Progress & Early-Warning Interventions
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Identify learners facing persistent conceptual difficulties, repeated procedural mistakes, or safety violations.
          </p>
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchInterventions}>
          Refresh
        </Button>
      </div>

      <Alert type="warning" title="Early-Intervention Philosophy">
        The framework continuously evaluates evidence from pre-lab diagnostic tests, live step-by-step experiment interactions, and repeated error thresholds to alert faculty before laboratory sessions conclude.
      </Alert>

      {error && (
        <Alert type="danger" title="Error Loading Interventions">
          {error}
        </Alert>
      )}

      <div
        className="glass-panel"
        style={{
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <Search size={18} style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search flagged students by name, ID, or experiment title..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <Card padding={false}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Checking student session telemetry and diagnostic assessments in MongoDB Atlas...
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={searchTerm ? 'No Matching Interventions' : 'No Students Flagged for Intervention'}
            description={
              searchTerm
                ? 'No flagged records matched your search query.'
                : 'All student laboratory sessions and diagnostic assessments are currently within normal thresholds. Alerts will appear here when students encounter repeated errors or require faculty escalation.'
            }
            icon={<UserCheck size={36} />}
          />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Department</th>
                    <th>Lab / Experiment</th>
                    <th>Flag Reason</th>
                    <th>Severity</th>
                    <th>Assigned Faculty</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div>
                          <div style={{ fontWeight: 600 }}>{item.studentName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            ID: {item.studentId}
                          </div>
                        </div>
                      </td>
                      <td>
                        <strong>{item.department}</strong>
                      </td>
                      <td>{item.currentExperiment}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          <AlertTriangle
                            size={16}
                            style={{
                              color:
                                item.severity === 'high' ? 'var(--danger)' : 'var(--warning)',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          />
                          <span style={{ fontSize: '0.85rem' }}>{item.flagReason}</span>
                        </div>
                      </td>
                      <td>{getSeverityBadge(item.severity)}</td>
                      <td>{item.assignedFaculty}</td>
                      <td>
                        <Badge variant="warning" dot>
                          Pending Review
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > itemsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filtered.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </Card>
    </div>
  );
};
