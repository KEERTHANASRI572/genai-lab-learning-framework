import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { sendError } from '../utils/apiResponse';
import { storageConfig } from '../config/storageConfig';

export const multerMemory = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: storageConfig.maxFileSizeBytes,
  },
});

function isValidUtf8Text(buffer: Buffer): boolean {
  if (buffer.length === 0 || buffer.includes(0)) {
    return false;
  }

  const text = buffer.toString('utf8');

  // Reject buffers that do not round-trip as valid UTF-8.
  if (!Buffer.from(text, 'utf8').equals(buffer)) {
    return false;
  }

  // Allow tabs, line breaks, carriage returns, and printable characters.
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;

    if (
      (code < 32 && code !== 9 && code !== 10 && code !== 13) ||
      code === 127
    ) {
      return false;
    }
  }

  return true;
}

function detectSupportedMime(
  buffer: Buffer,
  originalName: string
): string | undefined {
  // Check the PDF magic signature rather than trusting the browser MIME.
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString('ascii') === '%PDF-') {
    return 'application/pdf';
  }

  if (!isValidUtf8Text(buffer)) {
    return undefined;
  }

  const extension = path.extname(originalName).toLowerCase();

  if (extension === '.md' || extension === '.markdown') {
    return 'text/markdown';
  }

  if (extension === '.txt') {
    return 'text/plain';
  }

  return undefined;
}

export const validateUploadedFile = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!req.file) {
    return sendError(res, 'FILE_MISSING', 'No file was uploaded.', 400);
  }

  const { originalname, buffer } = req.file;

  if (!buffer || buffer.length === 0) {
    return sendError(res, 'FILE_EMPTY', 'Uploaded file is empty.', 400);
  }

  const detectedMime = detectSupportedMime(buffer, originalname);

  const allowedMimeTypes: readonly string[] =
    storageConfig.allowedMimeTypes;

  if (!detectedMime || !allowedMimeTypes.includes(detectedMime)) {
    return sendError(
      res,
      'FILE_UNSUPPORTED_MIME',
      `Uploaded file type '${detectedMime ?? 'unknown'}' is not supported. Allowed types: ${allowedMimeTypes.join(', ')}`,
      415
    );
  }

  (req as Request & {
    validatedFile?: {
      originalName: string;
      buffer: Buffer;
      mime: string;
      size: number;
    }
  }).validatedFile = {
    originalName: originalname,
    buffer,
    mime: detectedMime,
    size: buffer.length,
  };

  return next();
};