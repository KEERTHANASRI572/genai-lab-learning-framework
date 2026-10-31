import React, { useState, useEffect } from 'react';
import { LifeBuoy, Send, CheckCircle2, MessageSquare, AlertTriangle, Loader2 } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { listHelpRequests, updateHelpRequest, HelpRequestDto } from '../../services/api';

export const HelpRequestsView: React.FC = () => {
  const [requests, setRequests] = useState<HelpRequestDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [responseTexts, setResponseTexts] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const fetchRequests = async () => {
    setIsLoading(true);
    setError(null);
    const res = await listHelpRequests();
    if (res.success && res.data) {
      setRequests(res.data);
    } else {
      setError(res.error?.message || 'Failed to load student help requests.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const handleSendResponse = async (id: string, studentName: string) => {
    const text = responseTexts[id]?.trim();
    if (!text) return;

    setIsSubmitting((prev) => ({ ...prev, [id]: true }));

    const res = await updateHelpRequest(id, {
      facultyResponse: text,
      status: 'responded',
    });

    setIsSubmitting((prev) => ({ ...prev, [id]: false }));

    if (res.success) {
      setNotice(`Response dispatched to ${studentName}'s laboratory workspace.`);
      setResponseTexts((prev) => ({ ...prev, [id]: '' }));
      fetchRequests();
    } else {
      setError(res.error?.message || 'Failed to submit response.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Student Help Requests & AI Escalation Queue
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Review and respond to student inquiries escalated from the interactive laboratory workspace.
        </p>
      </div>

      {notice && (
        <Alert type="success" onClose={() => setNotice(null)}>
          {notice}
        </Alert>
      )}

      {error && (
        <Alert type="danger" title="Queue Error">
          {error}
        </Alert>
      )}

      <Alert type="info">
        <strong>Human-in-the-Loop Pedagogical Principle:</strong> When procedural difficulty or conceptual ambiguity is encountered in the laboratory, student queries are routed to faculty instructors for authoritative pedagogical resolution.
      </Alert>

      {isLoading && (
        <Card>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '24px 0', justifyContent: 'center' }}>
            <Loader2 className="animate-spin" size={24} style={{ color: 'var(--primary)' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Loading student inquiries...</span>
          </div>
        </Card>
      )}

      {!isLoading && requests.length === 0 && (
        <Card>
          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-secondary)' }}>
            No pending student help requests in your queue.
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {requests.map((esc) => {
          const isPending = esc.status === 'pending_review' || esc.status === 'in_review';
          return (
            <Card
              key={esc._id}
              title={`${esc.studentName} — ${esc.experimentTitle} [Step ${esc.stepNumber}]`}
              subtitle={`Reason: ${esc.escalationReason} · Created ${new Date(esc.createdAt).toLocaleTimeString()}`}
              headerAction={
                <Badge variant={isPending ? 'warning' : 'success'}>
                  {esc.status.replace('_', ' ').toUpperCase()}
                </Badge>
              }
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div
                  style={{
                    padding: 12,
                    borderRadius: 'var(--radius-sm)',
                    background: 'rgba(15, 23, 42, 0.6)',
                    borderLeft: `3px solid ${isPending ? 'var(--warning)' : 'var(--success)'}`,
                  }}
                >
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600 }}>
                    STUDENT'S INQUIRY:
                  </div>
                  <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    "{esc.studentQuery}"
                  </div>
                </div>

                {esc.resolution?.facultyResponse && (
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 'var(--radius-sm)',
                      background: 'rgba(16, 185, 129, 0.1)',
                      border: '1px solid rgba(16, 185, 129, 0.3)',
                    }}
                  >
                    <div style={{ fontSize: '0.75rem', color: 'var(--success)', marginBottom: 4, fontWeight: 600 }}>
                      FACULTY RESOLUTION:
                    </div>
                    <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                      {esc.resolution.facultyResponse}
                    </div>
                  </div>
                )}

                {isPending && (
                  <div>
                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Dispatched Guidance:
                    </label>
                    <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="Provide corrective instructions or apparatus configuration advice..."
                        value={responseTexts[esc._id] || ''}
                        onChange={(e) =>
                          setResponseTexts({ ...responseTexts, [esc._id]: e.target.value })
                        }
                      />
                      <Button
                        variant="primary"
                        icon={isSubmitting[esc._id] ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                        disabled={isSubmitting[esc._id] || !responseTexts[esc._id]?.trim()}
                        onClick={() => handleSendResponse(esc._id, esc.studentName)}
                      >
                        Reply
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
