import React from 'react';
import { ShieldCheck, Check, X, Info } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';

export const RoleManagementView: React.FC = () => {
  const permissions = [
    {
      feature: 'Author Laboratory Protocols & Manuals',
      admin: true,
      deptHead: true,
      faculty: true,
      student: false,
    },
    {
      feature: 'Configure Diagnostic & Summative Assessments',
      admin: true,
      deptHead: true,
      faculty: true,
      student: false,
    },
    {
      feature: 'Upload Official Resources for RAG Vectorization',
      admin: true,
      deptHead: true,
      faculty: true,
      student: false,
    },
    {
      feature: 'Execute Interactive Lab Workspace & AI Tutor',
      admin: true,
      deptHead: true,
      faculty: true,
      student: true,
    },
    {
      feature: 'View Student Learning Gaps & Escalated Queries',
      admin: true,
      deptHead: true,
      faculty: true,
      student: false,
    },
    {
      feature: 'Modify Department Academic Structure',
      admin: true,
      deptHead: true,
      faculty: false,
      student: false,
    },
    {
      feature: 'Manage College User Accounts & Invitations',
      admin: true,
      deptHead: false,
      faculty: false,
      student: false,
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Institutional Role Assignment & Permissions Matrix
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
          Define operational boundaries for academic roles within this college tenant.
        </p>
      </div>

      <Alert type="info">
        <strong>Strict Tenant Boundaries:</strong> College administrators can configure permissions and assign roles exclusively within their own institution. Cross-institutional role escalation is prohibited by platform authorization rules.
      </Alert>

      <Card
        title="Role Capability Matrix"
        subtitle="Role-based access boundaries enforced across API endpoints and UI views"
      >
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Capability / Action Domain</th>
                <th style={{ textAlign: 'center' }}>College Admin</th>
                <th style={{ textAlign: 'center' }}>Dept Head</th>
                <th style={{ textAlign: 'center' }}>Faculty</th>
                <th style={{ textAlign: 'center' }}>Student</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p, idx) => (
                <tr key={idx}>
                  <td><strong>{p.feature}</strong></td>
                  <td style={{ textAlign: 'center' }}>
                    {p.admin ? <Check size={18} style={{ color: 'var(--success)' }} /> : <X size={18} style={{ color: 'var(--danger)' }} />}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {p.deptHead ? <Check size={18} style={{ color: 'var(--success)' }} /> : <X size={18} style={{ color: 'var(--danger)' }} />}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {p.faculty ? <Check size={18} style={{ color: 'var(--success)' }} /> : <X size={18} style={{ color: 'var(--danger)' }} />}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {p.student ? <Check size={18} style={{ color: 'var(--success)' }} /> : <X size={18} style={{ color: 'var(--text-muted)' }} />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};
