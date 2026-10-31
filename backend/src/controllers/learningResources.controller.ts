import fs from 'fs/promises';
import path from 'path';
import mongoose from 'mongoose';
import { Request, Response } from 'express';
import {
  LearningResource,
  ILearningResource,
  ResourceCategory,
  ResourceFormat,
} from '../models/LearningResource';
import { Laboratory } from '../models/Laboratory';
import { ResourceChunk } from '../models/ResourceChunk';
import { extractTextFromBuffer } from '../ingestion/textExtractor';
import { chunkText } from '../ingestion/textChunker';
import { generateEmbeddings } from '../ingestion/embeddingProvider';
import { getStorageProvider } from '../storage/storageFactory';
import { LocalStorageProvider } from '../storage/localStorageProvider';
import {
  ensureDatabaseReady,
  isValidObjectId,
  sendError,
  sendSuccess,
  recordAuditLog,
} from '../utils/apiResponse';

function detectFormat(originalName: string, mimeType: string): ResourceFormat {
  const ext = path.extname(originalName).toLowerCase();
  if (ext === '.pdf' || mimeType.includes('pdf')) return 'PDF';
  if (ext === '.docx' || ext === '.doc' || mimeType.includes('word')) return 'DOCX';
  if (ext === '.mp4' || ext === '.webm' || mimeType.includes('video')) return 'VIDEO';
  return 'PDF';
}

/**
 * Upload a verified learning resource document for the authenticated tenant.
 */
export const uploadLearningResource = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const userId = req.user?.id;
  if (!userId) {
    sendError(res, 'UNAUTHENTICATED', 'Authentication required.', 401, undefined, req);
    return;
  }

  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    sendError(res, 'FILE_MISSING', 'A valid file is required for upload.', 400, undefined, req);
    return;
  }

  const { title, category, departmentId, courseId, laboratoryId, description } = req.body;

  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    sendError(res, 'VALIDATION_FAILED', 'Resource title must be at least 2 characters.', 400, undefined, req);
    return;
  }

  const validCategories: ResourceCategory[] = [
    'manual',
    'schematic',
    'safety_datasheet',
    'lecture_note',
    'protocol',
  ];
  const validatedCategory: ResourceCategory = validCategories.includes(category)
    ? category
    : 'manual';

  let validatedDeptId: mongoose.Types.ObjectId | undefined = undefined;
  if (departmentId && isValidObjectId(departmentId)) {
    validatedDeptId = new mongoose.Types.ObjectId(departmentId);
  }

  let validatedCourseId: mongoose.Types.ObjectId | undefined = undefined;
  if (courseId && isValidObjectId(courseId)) {
    validatedCourseId = new mongoose.Types.ObjectId(courseId);
  }

  let validatedLabId: mongoose.Types.ObjectId | undefined = undefined;
  if (laboratoryId && isValidObjectId(laboratoryId)) {
    validatedLabId = new mongoose.Types.ObjectId(laboratoryId);
    try {
      const labDoc = await Laboratory.findById(validatedLabId).lean();
      if (labDoc) {
        if (!validatedCourseId && labDoc.courseId) {
          validatedCourseId = labDoc.courseId;
        }
        if (!validatedDeptId && labDoc.departmentId) {
          validatedDeptId = labDoc.departmentId;
        }
      }
    } catch {
      // Continue with provided IDs if lookup fails
    }
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const originalName = req.file.originalname || 'document.pdf';
    const cleanFileName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `resources/${tenantId.toString()}/${Date.now()}-${cleanFileName}`;
    const detectedFormat = detectFormat(originalName, req.file.mimetype);

    // Save to storage provider
    const storageProvider = getStorageProvider();
    await storageProvider.upload(
      storageKey,
      req.file.buffer,
      req.file.mimetype || 'application/pdf',
      { originalName }
    );

    // Extract text, chunk, and generate embeddings for RAG vector indexing
    let ragStatus: 'ready' | 'failed' = 'ready';
    let failureReason: string | undefined = undefined;
    let chunksCount = 0;
    let extractedText = '';
    let pageOffsets: number[] | undefined = undefined;

    try {
      const extraction = await extractTextFromBuffer(req.file.buffer, req.file.mimetype || 'application/pdf');
      extractedText = extraction.text;
      pageOffsets = extraction.pageOffsets;

      if (!extractedText || extractedText.trim().length < 15) {
        throw new Error('Document contains empty or unparseable text. An extractable text layer is required for vector indexing.');
      }
    } catch (extractErr) {
      ragStatus = 'failed';
      failureReason = (extractErr as Error).message;
      console.warn('[RAG Indexing] Text extraction failed:', failureReason);
    }

    const resource: ILearningResource = await LearningResource.create({
      institutionId: tenantId,
      departmentId: validatedDeptId,
      courseId: validatedCourseId,
      laboratoryId: validatedLabId,
      title: title.trim(),
      description: typeof description === 'string' ? description.trim() : undefined,
      category: validatedCategory,
      format: detectedFormat,
      storageKey,
      storageBucket: process.env['STORAGE_BUCKET'] || 'institutional-storage',
      originalFilename: originalName,
      mimeType: req.file.mimetype || 'application/pdf',
      fileSizeBytes: req.file.size,
      ragIndexingStatus: ragStatus,
      processingFailureReason: failureReason,
      ragMetadata: {
        chunkCount: 0,
        indexedAt: ragStatus === 'ready' ? new Date() : undefined,
        embeddingModel: 'text-embedding-004',
        lastError: failureReason,
      },
      uploadedByUserId: userId,
      status: 'published',
      approvalStatus: 'approved',
    });

    if (ragStatus === 'ready') {
      try {
        const chunks = chunkText(extractedText, {
          chunkSize: 1000,
          chunkOverlap: 200,
          pageOffsets,
        });

        chunksCount = chunks.length;
        const embeddings = await generateEmbeddings(chunks.map((c) => c.text));

        const chunkDocs = chunks.map((chunk, idx) => ({
          institutionId: tenantId,
          resourceId: resource._id,
          resourceVersion: 1,
          chunkIndex: idx,
          text: chunk.text,
          pageNumber: chunk.pageNumber,
          embedding: embeddings[idx]?.vector || [],
          embeddingModel: embeddings[idx]?.model || 'text-embedding-004',
          embeddingDimension: embeddings[idx]?.dimension || 768,
        }));

        await ResourceChunk.insertMany(chunkDocs);

        resource.ragMetadata.chunkCount = chunksCount;
        resource.ragMetadata.indexedAt = new Date();
        await resource.save();
      } catch (chunkErr) {
        resource.ragIndexingStatus = 'failed';
        resource.processingFailureReason = `Vector indexing failed: ${(chunkErr as Error).message}`;
        resource.ragMetadata.lastError = resource.processingFailureReason;
        await resource.save();
      }
    }

    const populated = await LearningResource.findById(resource._id)
      .populate('departmentId', 'name code')
      .populate('courseId', 'name code')
      .populate('laboratoryId', 'name code')
      .populate('uploadedByUserId', 'name email role');

    recordAuditLog({
      req,
      action: 'UPLOAD_LEARNING_RESOURCE',
      targetDomain: 'resource',
      targetResourceId: (resource._id as mongoose.Types.ObjectId).toString(),
      status: 'success',
      details: { title: resource.title, category: validatedCategory, ragIndexingStatus: resource.ragIndexingStatus },
    });

    sendSuccess(
      res,
      populated,
      {
        message:
          resource.ragIndexingStatus === 'ready'
            ? `Resource uploaded and indexed (${resource.ragMetadata.chunkCount} vector chunks ready for question generation).`
            : `Resource uploaded, but vector indexing failed: ${resource.processingFailureReason}`,
      },
      201
    );
  } catch (err: unknown) {
    sendError(res, 'UPLOAD_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * Re-trigger extraction, chunking, and vector indexing for an existing learning resource.
 */
export const reindexLearningResource = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  const { resourceId } = req.params;

  if (!isValidObjectId(resourceId)) {
    sendError(res, 'INVALID_ID', 'Invalid resource ID.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const resource = await LearningResource.findOne({ _id: resourceId, institutionId: tenantId });
    if (!resource) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Resource not found in your institution.', 404, undefined, req);
      return;
    }

    const storageProvider = getStorageProvider();
    if (!storageProvider.getBuffer) {
      sendError(res, 'STORAGE_UNSUPPORTED', 'Underlying storage provider does not support buffer retrieval for reindexing.', 500, undefined, req);
      return;
    }

    const fileBuffer = await storageProvider.getBuffer(resource.storageKey);
    const extraction = await extractTextFromBuffer(fileBuffer, resource.mimeType);

    if (!extraction.text || extraction.text.trim().length < 15) {
      throw new Error('Document contains empty or unparseable text layer.');
    }

    const chunks = chunkText(extraction.text, {
      chunkSize: 1000,
      chunkOverlap: 200,
      pageOffsets: extraction.pageOffsets,
    });

    const embeddings = await generateEmbeddings(chunks.map((c) => c.text));

    // Clear previous chunks
    await ResourceChunk.deleteMany({ resourceId: resource._id, institutionId: tenantId });

    // Insert new chunks
    const chunkDocs = chunks.map((chunk, idx) => ({
      institutionId: tenantId,
      resourceId: resource._id,
      resourceVersion: 1,
      chunkIndex: idx,
      text: chunk.text,
      pageNumber: chunk.pageNumber,
      embedding: embeddings[idx]?.vector || [],
      embeddingModel: embeddings[idx]?.model || 'text-embedding-004',
      embeddingDimension: embeddings[idx]?.dimension || 768,
    }));

    await ResourceChunk.insertMany(chunkDocs);

    resource.ragIndexingStatus = 'ready';
    resource.processingFailureReason = undefined;
    resource.ragMetadata.chunkCount = chunks.length;
    resource.ragMetadata.indexedAt = new Date();
    resource.ragMetadata.lastError = undefined;
    await resource.save();

    await recordAuditLog({
      req,
      action: 'REINDEX_LEARNING_RESOURCE',
      targetDomain: 'resource',
      targetResourceId: resourceId,
      institutionId: tenantId,
      status: 'success',
      details: { title: resource.title, chunkCount: chunks.length },
    });

    sendSuccess(res, resource, { message: `Document re-indexed successfully (${chunks.length} chunks indexed).` });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Reindexing failed.';
    await LearningResource.updateOne(
      { _id: resourceId, institutionId: tenantId },
      { $set: { ragIndexingStatus: 'failed', processingFailureReason: msg } }
    );
    sendError(res, 'REINDEX_FAILED', msg, 500, undefined, req);
  }
};

/**
 * List learning resources strictly for the authenticated tenant.
 */
export const listLearningResources = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const query: Record<string, unknown> = {
      institutionId: tenantId,
      status: { $ne: 'archived' },
    };

    if (req.query['category']) {
      query['category'] = req.query['category'];
    }
    if (req.query['departmentId'] && isValidObjectId(req.query['departmentId'] as string)) {
      query['departmentId'] = req.query['departmentId'];
    }
    if (req.query['courseId'] && isValidObjectId(req.query['courseId'] as string)) {
      query['courseId'] = req.query['courseId'];
    }
    if (req.query['laboratoryId'] && isValidObjectId(req.query['laboratoryId'] as string)) {
      query['laboratoryId'] = req.query['laboratoryId'];
    }

    const resources = await LearningResource.find(query)
      .populate('departmentId', 'name code')
      .populate('courseId', 'name code')
      .populate('laboratoryId', 'name code')
      .populate('uploadedByUserId', 'name email role')
      .sort({ createdAt: -1 });

    sendSuccess(res, resources, { message: 'Learning resources retrieved successfully.' });
  } catch (err: unknown) {
    sendError(res, 'LIST_RESOURCES_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * Download a learning resource document.
 */
export const downloadLearningResource = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { resourceId } = req.params;
  if (!isValidObjectId(resourceId)) {
    sendError(res, 'INVALID_ID', 'Invalid resource ID format.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const resource = await LearningResource.findOne({ _id: resourceId, institutionId: tenantId });
    if (!resource) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Resource not found in this institution.', 404, undefined, req);
      return;
    }

    const storageProvider = getStorageProvider();

    if (storageProvider instanceof LocalStorageProvider) {
      const localPath = storageProvider.getLocalFilePath(resource.storageKey);
      try {
        await fs.access(localPath);
        res.setHeader('Content-Type', resource.mimeType || 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(resource.originalFilename)}"`);
        return res.sendFile(path.resolve(localPath));
      } catch {
        sendError(res, 'FILE_NOT_FOUND', 'Resource file could not be located on storage.', 404, undefined, req);
        return;
      }
    }

    // For cloud S3 storage, redirect to presigned download URL
    const signedUrl = await storageProvider.getSignedDownloadUrl(resource.storageKey, 300);
    return res.redirect(signedUrl);
  } catch (err: unknown) {
    sendError(res, 'DOWNLOAD_FAILED', (err as Error).message, 500, undefined, req);
  }
};

/**
 * Delete a learning resource.
 */
export const deleteLearningResource = async (req: Request, res: Response): Promise<void> => {
  const tenantId = req.tenantId;
  if (!tenantId) {
    sendError(res, 'NO_INSTITUTIONAL_TENANCY', 'An institutional tenant context is required.', 403, undefined, req);
    return;
  }

  const { resourceId } = req.params;
  if (!isValidObjectId(resourceId)) {
    sendError(res, 'INVALID_ID', 'Invalid resource ID format.', 400, undefined, req);
    return;
  }

  if (!ensureDatabaseReady(req, res)) return;

  try {
    const resource = await LearningResource.findOne({ _id: resourceId, institutionId: tenantId });
    if (!resource) {
      sendError(res, 'RESOURCE_NOT_FOUND', 'Resource not found in this institution.', 404, undefined, req);
      return;
    }

    try {
      const storageProvider = getStorageProvider();
      await storageProvider.deleteObject(resource.storageKey);
    } catch (storageErr) {
      console.warn('[Storage] Failed to delete object from storage:', (storageErr as Error).message);
    }

    await LearningResource.deleteOne({ _id: resource._id, institutionId: tenantId });

    recordAuditLog({
      req,
      action: 'DELETE_LEARNING_RESOURCE',
      targetDomain: 'resource',
      targetResourceId: resourceId,
      status: 'success',
      details: { title: resource.title },
    });

    sendSuccess(res, { deleted: true }, { message: 'Learning resource deleted successfully.' });
  } catch (err: unknown) {
    sendError(res, 'DELETE_FAILED', (err as Error).message, 500, undefined, req);
  }
};
