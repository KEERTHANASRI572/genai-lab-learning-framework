
// Default max file size: 50 MB
const maxFileSizeMb = parseInt(process.env['STORAGE_MAX_FILE_SIZE_MB'] || '50', 10);
if (isNaN(maxFileSizeMb) || maxFileSizeMb <= 0) {
  console.warn('[storageConfig] Invalid STORAGE_MAX_FILE_SIZE_MB, falling back to 50 MB');
}

export const storageConfig = {
  maxFileSizeBytes: (maxFileSizeMb > 0 ? maxFileSizeMb : 50) * 1024 * 1024,
  // Allowed MIME types for Phase 4 (PDF, markdown, plain text)
  allowedMimeTypes: [
    'application/pdf',
    'text/markdown',
    'text/plain',
    // optional aliases
    'application/octet-stream', // for PDFs where mime detection fails
  ] as const,
};

