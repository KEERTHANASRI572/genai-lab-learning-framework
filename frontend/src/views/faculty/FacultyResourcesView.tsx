import React, { useState, useEffect } from 'react';
import { BookOpen, Upload, FileText, CheckCircle2, Search, Trash2, Download, AlertTriangle, Loader2, X, Plus, Sparkles, RefreshCw } from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { FormField } from '../../components/common/FormField';
import { EmptyState } from '../../components/common/EmptyState';
import { useApp } from '../../context/AppContext';
import {
  listLearningResources,
  uploadLearningResource,
  downloadLearningResource,
  deleteLearningResource,
  reindexLearningResource,
  getLaboratories,
  getDepartments,
  LearningResourceDto,
  DepartmentDto,
  LaboratoryDto,
} from '../../services/api';

export const FacultyResourcesView: React.FC = () => {
  const { setCurrentView } = useApp();
  const [resources, setResources] = useState<LearningResourceDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [laboratories, setLaboratories] = useState<LaboratoryDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState<string>('manual');
  const [uploadDeptId, setUploadDeptId] = useState('');
  const [uploadLabId, setUploadLabId] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmResource, setDeleteConfirmResource] = useState<LearningResourceDto | null>(null);

  const fetchResources = async () => {
    setLoading(true);
    setError(null);
    try {
      const [resRes, deptRes, labRes] = await Promise.all([
        listLearningResources(),
        getDepartments(),
        getLaboratories(),
      ]);

      if (resRes.success && resRes.data) {
        setResources(resRes.data);
      } else {
        setError(resRes.error?.message || 'Failed to load institutional learning resources.');
      }

      if (deptRes.success && deptRes.data) {
        setDepartments(deptRes.data);
      }
      if (labRes.success && labRes.data) {
        setLaboratories(labRes.data);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Network error loading resources.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchResources();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadTitle.trim()) {
      setError('Document title is required.');
      return;
    }
    if (!selectedFile) {
      setError('Please select a file to upload (PDF, DOCX, etc.).');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('title', uploadTitle.trim());
    formData.append('category', uploadCategory);
    if (uploadDeptId) formData.append('departmentId', uploadDeptId);
    if (uploadLabId) formData.append('laboratoryId', uploadLabId);
    if (uploadDescription) formData.append('description', uploadDescription.trim());
    formData.append('file', selectedFile);

    try {
      const res = await uploadLearningResource(formData);
      if (res.success) {
        setSuccess(`Document "${uploadTitle}" uploaded and indexed successfully.`);
        setShowUploadModal(false);
        setUploadTitle('');
        setUploadDescription('');
        setSelectedFile(null);
        fetchResources();
      } else {
        setError(res.error?.message || 'Failed to upload document.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error uploading document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (resourceId: string, filename: string) => {
    try {
      const blob = await downloadLearningResource(resourceId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename || 'resource.pdf';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to download document.');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirmResource) return;
    setDeletingId(deleteConfirmResource._id);
    try {
      const res = await deleteLearningResource(deleteConfirmResource._id);
      if (res.success) {
        setSuccess(`Resource "${deleteConfirmResource.title}" removed successfully.`);
        setDeleteConfirmResource(null);
        fetchResources();
      } else {
        setError(res.error?.message || 'Failed to delete resource.');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error deleting resource.');
    } finally {
      setDeletingId(null);
    }
  };

  const handleReindex = async (resourceId: string) => {
    setReindexingId(resourceId);
    setError(null);
    setSuccess(null);
    try {
      const res = await reindexLearningResource(resourceId);
      if (res.success) {
        setSuccess(`Document reindexed successfully with ${res.data?.ragMetadata?.chunkCount || 0} chunks.`);
        fetchResources();
      } else {
        setError(res.error?.message || 'Re-indexing failed.');
        fetchResources();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error re-indexing resource.');
    } finally {
      setReindexingId(null);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes || bytes <= 0) return '0 KB';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.round(bytes / 1024)} KB`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Faculty Approved Learning Resources (RAG Knowledge Base)
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Curate verified course materials that ground the student AI assistant in authorized laboratory protocols.
          </p>
        </div>
        <Button variant="primary" icon={<Upload size={16} />} onClick={() => setShowUploadModal(true)}>
          Upload Official Document
        </Button>
      </div>

      {success && (
        <Alert type="success" title="Success" onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert type="danger" title="Error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Alert type="info">
        <strong>Strict Institutional RAG Verification:</strong> AI explanations, hints, and step-by-step guidance provided to students cite these documents directly. Documents are chunked and embedded in persistent storage with institutional tenant tags.
      </Alert>

      {/* Main Resources Table */}
      <Card padding={false}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0' }}>
            <Loader2 className="animate-spin" size={28} style={{ color: 'var(--brand-primary)' }} />
            <span style={{ marginLeft: 12, color: 'var(--text-secondary)' }}>Loading verified institutional resources...</span>
          </div>
        ) : resources.length === 0 ? (
          <EmptyState
            title="No Approved Learning Resources"
            description="No approved learning resources are available for your assigned laboratories. Upload official laboratory manuals or datasheets to ground student AI tutoring."
            icon={<BookOpen size={32} />}
          />
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Document Title</th>
                  <th>Category / Lab</th>
                  <th>File Size</th>
                  <th>RAG Chunks</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {resources.map((res) => {
                  const chunkCount = res.ragMetadata?.chunkCount || 0;
                  const isReady = res.ragIndexingStatus === 'ready' && chunkCount > 0;
                  const deptObj = res.departmentId as unknown as { name?: string; code?: string } | undefined;
                  const labObj = res.laboratoryId as unknown as { name?: string; code?: string } | undefined;

                  return (
                    <tr key={res._id}>
                      <td>
                        <strong>{res.title}</strong>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {res.format} Document · {res.originalFilename}
                          {res.createdAt && ` · Uploaded ${new Date(res.createdAt).toLocaleDateString()}`}
                        </div>
                      </td>
                      <td>
                        <Badge variant="neutral">{res.category ? res.category.replace('_', ' ') : 'Manual'}</Badge>
                        {(labObj?.code || deptObj?.code) && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            {labObj?.code || deptObj?.code}
                          </div>
                        )}
                      </td>
                      <td>{formatFileSize(res.fileSizeBytes)}</td>
                      <td>
                        {chunkCount > 0 ? (
                          <span>{chunkCount} Chunks</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>0 Chunks</span>
                        )}
                      </td>
                      <td>
                        {isReady ? (
                          <Badge variant="success" dot>Vector Indexed</Badge>
                        ) : res.ragIndexingStatus === 'pending' || res.ragIndexingStatus === 'indexing' ? (
                          <Badge variant="warning" dot>Indexing in Progress</Badge>
                        ) : res.ragIndexingStatus === 'failed' ? (
                          <div>
                            <Badge variant="danger" dot>Indexing Failed</Badge>
                            {res.processingFailureReason && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--danger)', marginTop: 4, maxWidth: 220 }}>
                                {res.processingFailureReason}
                              </div>
                            )}
                          </div>
                        ) : (
                          <Badge variant="neutral">Pending</Badge>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          {isReady && (
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<Sparkles size={14} style={{ color: 'var(--brand-primary)' }} />}
                              onClick={() => setCurrentView('faculty-assessments')}
                            >
                              Generate Questions
                            </Button>
                          )}
                          {res.ragIndexingStatus === 'failed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              icon={
                                reindexingId === res._id ? (
                                  <Loader2 className="animate-spin" size={14} />
                                ) : (
                                  <RefreshCw size={14} />
                                )
                              }
                              onClick={() => handleReindex(res._id)}
                              disabled={reindexingId === res._id}
                            >
                              {reindexingId === res._id ? 'Reindexing...' : 'Retry Indexing'}
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            icon={<Download size={14} />}
                            onClick={() => handleDownload(res._id, res.originalFilename || `${res.title}.pdf`)}
                          >
                            Download
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            style={{ color: 'var(--danger)' }}
                            icon={<Trash2 size={14} />}
                            onClick={() => setDeleteConfirmResource(res)}
                          >
                            Archive
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Upload Official Learning Resource</h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadSubmit}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <FormField label="Document Title" required>
                  <input
                    type="text"
                    className="form-input"
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Analog Circuits Laboratory Manual 2026"
                    required
                  />
                </FormField>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <FormField label="Category">
                    <select
                      className="form-input"
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                    >
                      <option value="manual">Laboratory Manual</option>
                      <option value="schematic">Circuit Schematic</option>
                      <option value="safety_datasheet">Safety Datasheet</option>
                      <option value="protocol">Standard Protocol</option>
                      <option value="lecture_note">Lecture Notes</option>
                    </select>
                  </FormField>

                  <FormField label="Target Department">
                    <select
                      className="form-input"
                      value={uploadDeptId}
                      onChange={(e) => setUploadDeptId(e.target.value)}
                    >
                      <option value="">General Institutional</option>
                      {departments.map((d) => (
                        <option key={d._id} value={d._id}>
                          {d.code} — {d.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>

                {laboratories.length > 0 && (
                  <FormField label="Associated Laboratory (Optional)">
                    <select
                      className="form-input"
                      value={uploadLabId}
                      onChange={(e) => setUploadLabId(e.target.value)}
                    >
                      <option value="">All Laboratories</option>
                      {laboratories.map((l) => (
                        <option key={l._id} value={l._id}>
                          {l.code} — {l.name}
                        </option>
                      ))}
                    </select>
                  </FormField>
                )}

                <FormField label="Document File (PDF / DOCX)" required>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc"
                    onChange={handleFileChange}
                    className="form-input"
                    required
                  />
                </FormField>

                <FormField label="Description / Pedagogical Scope">
                  <textarea
                    className="form-input"
                    value={uploadDescription}
                    onChange={(e) => setUploadDescription(e.target.value)}
                    placeholder="Provide context on which experimental procedures or theoretical principles this document covers..."
                    rows={3}
                  />
                </FormField>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <Button variant="ghost" type="button" onClick={() => setShowUploadModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={isUploading} icon={isUploading ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}>
                  {isUploading ? 'Uploading & Indexing...' : 'Upload & Index'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Archive Confirmation Dialog */}
      {deleteConfirmResource && (
        <div className="modal-backdrop">
          <div className="modal-card" style={{ maxWidth: 440 }}>
            <div className="modal-header">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--danger)' }}>
                Archive Learning Resource
              </h3>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                Are you sure you want to archive <strong>"{deleteConfirmResource.title}"</strong>?
              </p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
                Archiving will preserve historical vector citations while removing this document from active student AI tutor retrieval.
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <Button variant="ghost" onClick={() => setDeleteConfirmResource(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={Boolean(deletingId)}
                icon={deletingId ? <Loader2 className="animate-spin" size={14} /> : <Trash2 size={14} />}
              >
                {deletingId ? 'Archiving...' : 'Confirm Archive'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
