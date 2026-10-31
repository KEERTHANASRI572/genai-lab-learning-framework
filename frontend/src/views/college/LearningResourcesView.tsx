import React, { useState, useEffect, useCallback } from 'react';
import {
  Upload,
  Search,
  FileText,
  AlertTriangle,
  Download,
  Trash2,
  RefreshCw,
  FolderOpen,
} from 'lucide-react';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { Alert } from '../../components/common/Alert';
import { Pagination } from '../../components/common/Pagination';
import { EmptyState } from '../../components/common/EmptyState';
import { ModalDialog } from '../../components/common/ModalDialog';
import {
  listLearningResources,
  uploadLearningResource,
  deleteLearningResource,
  getLearningResourceDownloadUrl,
  getDepartments,
  LearningResourceDto,
  DepartmentDto,
} from '../../services/api';

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export const LearningResourcesView: React.FC = () => {
  const [resources, setResources] = useState<LearningResourceDto[]>([]);
  const [departments, setDepartments] = useState<DepartmentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Upload Modal State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [fileToUpload, setFileToUpload] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadCategory, setUploadCategory] = useState('manual');
  const [uploadDeptId, setUploadDeptId] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');

  // Delete State
  const [resourceToDelete, setResourceToDelete] = useState<LearningResourceDto | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchResources = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listLearningResources();
      if (res.success && res.data) {
        setResources(res.data);
      } else {
        setError(res.error?.message || 'Failed to load learning resources.');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDepts = useCallback(async () => {
    try {
      const res = await getDepartments();
      if (res.success && res.data) {
        setDepartments(res.data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    fetchResources();
    fetchDepts();
  }, [fetchResources, fetchDepts]);

  const handleOpenUpload = () => {
    setFileToUpload(null);
    setUploadTitle('');
    setUploadCategory('manual');
    setUploadDeptId(departments.length > 0 ? departments[0]._id : '');
    setUploadDescription('');
    setUploadError(null);
    setIsUploadOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFileToUpload(f);
      if (!uploadTitle) {
        // Auto-fill title from filename
        const nameWithoutExt = f.name.replace(/\.[^/.]+$/, '');
        setUploadTitle(nameWithoutExt);
      }
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fileToUpload) {
      setUploadError('Please choose a file to upload.');
      return;
    }
    if (!uploadTitle.trim()) {
      setUploadError('Resource title is required.');
      return;
    }

    setUploading(true);
    setUploadError(null);

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('title', uploadTitle.trim());
    formData.append('category', uploadCategory);
    if (uploadDeptId) formData.append('departmentId', uploadDeptId);
    if (uploadDescription.trim()) formData.append('description', uploadDescription.trim());

    try {
      const res = await uploadLearningResource(formData);
      if (res.success) {
        setIsUploadOpen(false);
        await fetchResources();
      } else {
        setUploadError(res.error?.message || 'Failed to upload resource.');
      }
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!resourceToDelete) return;
    setDeleting(true);
    try {
      const res = await deleteLearningResource(resourceToDelete._id);
      if (res.success) {
        setResourceToDelete(null);
        await fetchResources();
      } else {
        alert(res.error?.message || 'Failed to delete resource.');
      }
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeleting(false);
    }
  };

  const filteredResources = resources.filter((item) => {
    const q = searchTerm.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q) ||
      (item.departmentId?.name && item.departmentId.name.toLowerCase().includes(q)) ||
      (item.departmentId?.code && item.departmentId.code.toLowerCase().includes(q))
    );
  });

  const itemsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredResources.length / itemsPerPage));
  const paginatedResources = filteredResources.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Institutional Learning Resources & RAG Vector Store
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Manage verified laboratory manuals and safety protocols. All student AI queries are strictly grounded in these approved documents.
          </p>
        </div>
        <Button variant="primary" icon={<Upload size={16} />} onClick={handleOpenUpload}>
          Upload Approved Lab Resource
        </Button>
      </div>

      <Alert type="info" title="RAG Grounding & Safety Requirement">
        The generative AI learning assistant answers student questions <strong>strictly using retrieved passages from these institution-approved documents</strong>. AI models are prevented from answering procedural or safety questions from unverified external web sources.
      </Alert>

      {error && (
        <Alert type="danger" title="Error Loading Resources">
          {error}
        </Alert>
      )}

      {/* Search Toolbar */}
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
            placeholder="Search verified lab manuals, apparatus guides, or safety sheets..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={fetchResources}>
          Refresh
        </Button>
      </div>

      <Card padding={false}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading verified resources from MongoDB Atlas...
          </div>
        ) : filteredResources.length === 0 ? (
          <EmptyState
            title={searchTerm ? 'No Matching Learning Resources' : 'No Learning Resources Uploaded'}
            description={
              searchTerm
                ? 'No documents matched your search filter. Try clearing your search term.'
                : 'No approved lab manuals or safety datasheets have been uploaded for this institution yet. Click "Upload Approved Lab Resource" above to add documents.'
            }
            icon={<FolderOpen size={36} />}
          />
        ) : (
          <>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Resource Document</th>
                    <th>Category</th>
                    <th>Department</th>
                    <th>File Details</th>
                    <th>RAG Vector Index Status</th>
                    <th>Uploaded</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedResources.map((res) => {
                    const chunkCount = res.ragMetadata?.chunkCount || 0;
                    return (
                      <tr key={res._id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <FileText size={20} style={{ color: 'var(--brand-primary)', flexShrink: 0 }} />
                            <div>
                              <div style={{ fontWeight: 600 }}>{res.title}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {res.originalFilename}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge variant="neutral">
                            {res.category.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td>
                          <strong>{res.departmentId ? res.departmentId.code || res.departmentId.name : 'General'}</strong>
                        </td>
                        <td>
                          {res.format} · {formatBytes(res.fileSizeBytes)}
                        </td>
                        <td>
                          {res.ragIndexingStatus === 'ready' && (
                            <Badge variant="success" dot>
                              Indexed ({chunkCount} chunks)
                            </Badge>
                          )}
                          {res.ragIndexingStatus === 'indexing' && (
                            <Badge variant="warning" dot>
                              Indexing Chunks...
                            </Badge>
                          )}
                          {res.ragIndexingStatus === 'pending' && (
                            <Badge variant="neutral" dot>
                              Pending Indexing
                            </Badge>
                          )}
                          {res.ragIndexingStatus === 'failed' && (
                            <Badge variant="danger" dot>
                              Indexing Failed
                            </Badge>
                          )}
                        </td>
                        <td>{new Date(res.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <Button
                              variant="outline"
                              size="sm"
                              icon={<Download size={14} />}
                              onClick={() => {
                                window.open(getLearningResourceDownloadUrl(res._id), '_blank');
                              }}
                            >
                              Download
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<Trash2 size={14} />}
                              onClick={() => setResourceToDelete(res)}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {filteredResources.length > itemsPerPage && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredResources.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}
      </Card>

      {/* Upload Resource Modal */}
      <ModalDialog
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        title="Upload Approved Lab Resource"
        description="Ground student AI learning in verified curriculum documents and laboratory safety protocols."
        maxWidth="580px"
      >
        <form onSubmit={handleUploadSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {uploadError && <Alert type="danger">{uploadError}</Alert>}

          <div>
            <label className="form-label">
              Resource File <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="file"
              className="form-input"
              accept=".pdf,.docx,.doc,.txt,.md"
              onChange={handleFileChange}
              required
            />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Supported: PDF, DOCX, TXT, Markdown (Max 50MB)
            </div>
          </div>

          <div>
            <label className="form-label">
              Resource Title <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. Analog Circuit Lab Manual & Safety Protocols"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">
                Category <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                className="form-input"
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
              >
                <option value="manual">Official Lab Manual</option>
                <option value="schematic">Equipment / Schematic</option>
                <option value="safety_datasheet">Safety Data Sheet</option>
                <option value="lecture_note">Lecture Notes</option>
                <option value="protocol">Experimental Protocol</option>
              </select>
            </div>

            <div>
              <label className="form-label">Department</label>
              <select
                className="form-input"
                value={uploadDeptId}
                onChange={(e) => setUploadDeptId(e.target.value)}
              >
                <option value="">General / Institutional</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Description (Optional)</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Provide context or instructions regarding this curriculum resource..."
              value={uploadDescription}
              onChange={(e) => setUploadDescription(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 10 }}>
            <Button variant="ghost" onClick={() => setIsUploadOpen(false)} disabled={uploading}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={uploading} icon={<Upload size={14} />}>
              {uploading ? 'Uploading & Indexing...' : 'Upload & Ground Resource'}
            </Button>
          </div>
        </form>
      </ModalDialog>

      {/* Delete Confirmation Modal */}
      <ModalDialog
        isOpen={!!resourceToDelete}
        onClose={() => setResourceToDelete(null)}
        title="Delete Learning Resource"
        description="Are you sure you want to delete this resource?"
        maxWidth="480px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Document <strong>{resourceToDelete?.title}</strong> will be permanently removed from storage and the RAG vector index.
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <Button variant="ghost" onClick={() => setResourceToDelete(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteConfirm} disabled={deleting} icon={<Trash2 size={14} />}>
              {deleting ? 'Deleting...' : 'Delete Resource'}
            </Button>
          </div>
        </div>
      </ModalDialog>
    </div>
  );
};
