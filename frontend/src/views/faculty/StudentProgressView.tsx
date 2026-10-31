import React, { useState, useEffect } from 'react';
import { GraduationCap, Search, CheckCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Button } from '../../components/common/Button';
import { Alert } from '../../components/common/Alert';
import { EmptyState } from '../../components/common/EmptyState';
import { getUsers, getStudentProgress, UserDto } from '../../services/api';

export const StudentProgressView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [students, setStudents] = useState<UserDto[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentProgress, setSelectedStudentProgress] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadStudents() {
      setIsLoading(true);
      setError(null);
      const res = await getUsers({ role: 'student' });
      if (res.success && res.data) {
        setStudents(res.data);
      } else {
        setError(res.error?.message || 'Failed to load enrolled students.');
      }
      setIsLoading(false);
    }
    loadStudents();
  }, []);

  const handleInspectStudent = async (studentId: string) => {
    setSelectedStudentId(studentId);
    setIsLoadingDetail(true);
    const res = await getStudentProgress(studentId);
    if (res.success && res.data) {
      setSelectedStudentProgress(res.data);
    }
    setIsLoadingDetail(false);
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Student Progress & Topic-Wise Mastery
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Review real-time experiment progression, dynamic topic levels, and diagnostic results for enrolled lab cohorts.
        </p>
      </div>

      {error && (
        <Alert type="danger" title="Student Roster Error">
          {error}
        </Alert>
      )}

      <div style={{ display: 'flex', gap: 12 }}>
        <input
          type="text"
          className="form-input"
          placeholder="Search students by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{ maxWidth: 380 }}
        />
      </div>

      {isLoading ? (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Loading student cohort from database...</span>
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            title={searchTerm ? 'No Matching Students' : 'No Enrolled Students in Cohort'}
            description={
              searchTerm
                ? `No student accounts matched "${searchTerm}". Try adjusting your search term.`
                : 'No student accounts are currently enrolled in this department or course in MongoDB Atlas.'
            }
            icon={<GraduationCap size={36} />}
          />
        </Card>
      ) : (
        <Card padding={false}>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Institutional Email</th>
                  <th>Program / Course</th>
                  <th>Account Status</th>
                  <th>Enrolled Since</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <tr key={s._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{s.name}</div>
                    </td>
                    <td>{s.email}</td>
                    <td>
                      {s.courseId ? (
                        <span>{(s.courseId as any).code || (s.courseId as any).name || 'Assigned Course'}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <Badge variant={s.status === 'active' ? 'success' : 'neutral'}>
                        {s.status}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      {new Date(s.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleInspectStudent(s._id)}
                      >
                        Inspect Progress
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Selected Student Detail Section */}
      {selectedStudentId && (
        <Card title="Student Laboratory Progress Detail">
          {isLoadingDetail ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16 }}>
              <Loader2 className="animate-spin" size={18} />
              <span>Fetching laboratory sessions and diagnostic attempts...</span>
            </div>
          ) : selectedStudentProgress ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Active Learning Sessions ({selectedStudentProgress.sessions?.length || 0})
                </h4>
                {selectedStudentProgress.sessions?.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    No laboratory sessions started yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {selectedStudentProgress.sessions.map((sess: any) => (
                      <div
                        key={sess._id}
                        style={{
                          padding: 12,
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(15, 23, 42, 0.5)',
                          border: '1px solid var(--border-subtle)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <strong>{sess.experimentId?.title || 'Experiment'}</strong>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Step {sess.currentStepNumber} · Level: {sess.assignedScaffoldingLevel}
                          </div>
                        </div>
                        <Badge variant={sess.sessionStatus === 'completed' ? 'success' : 'info'}>
                          {sess.sessionStatus}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h4 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Diagnostic Attempts ({selectedStudentProgress.attempts?.length || 0})
                </h4>
                {selectedStudentProgress.attempts?.length === 0 ? (
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: 4 }}>
                    No diagnostic assessment attempts recorded.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                    {selectedStudentProgress.attempts.map((att: any) => (
                      <div
                        key={att._id}
                        style={{
                          padding: 12,
                          borderRadius: 'var(--radius-sm)',
                          background: 'rgba(15, 23, 42, 0.5)',
                          border: '1px solid var(--border-subtle)',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{att.experimentId?.title || 'Experiment Diagnostic'}</strong>
                          <Badge level={att.determinedLearningLevel}>
                            {att.determinedLearningLevel}
                          </Badge>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                          Score: {att.scorePercent}% ({att.totalScore}/{att.maxScore} pts) · {att.diagnosisExplanation}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)' }}>No records available.</p>
          )}
        </Card>
      )}
    </div>
  );
};
