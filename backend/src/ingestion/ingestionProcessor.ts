// Updated ingestion processor with lease token handling and proper S3 client usage
import { extractTextFromBuffer } from './textExtractor';
import { chunkText } from './textChunker';
import { generateEmbeddings } from './embeddingProvider';
import { IngestionJob } from '../models/IngestionJob';
import { ResourceChunk } from '../models/ResourceChunk';
import { LearningResource } from '../models/LearningResource';
import mongoose from 'mongoose';

/**
 * Process a single ingestion job. Steps:
 * 1. Claim the job (set status to processing, increment attempts, set lease token and expiry).
 * 2. Retrieve the stored file from the storage provider.
 * 3. Extract raw text.
 * 4. Chunk the text.
 * 5. Generate embeddings for each chunk (batched).
 * 6. Persist chunks (idempotent, duplicate‑preventing).
 * 7. Mark job as completed or failed.
 */
export const processIngestionJob = async (jobId: string): Promise<void> => {
  const leaseDurationMs = 5 * 60 * 1000; // 5 minutes
  const leaseToken = crypto.randomUUID();
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + leaseDurationMs);

  // Claim the job, allowing takeover if lease expired
  const job = await IngestionJob.findOneAndUpdate(
    {
      _id: jobId,
      $or: [
        { status: 'queued' },
        { status: 'processing', processingLeaseExpiresAt: { $lte: now } },
      ],
    },
    {
      $set: { status: 'processing', processingLeaseExpiresAt: leaseExpiresAt, processingLeaseToken: leaseToken },
      $inc: { attempts: 1 },
    },
    { new: true }
  ).exec();

  if (!job) {
    // Already claimed or another worker holds lease
    return;
  }

  try {
    // Retrieve resource metadata
    const resource = await LearningResource.findById(job.resourceId).exec();
    if (!resource) throw new Error('Associated learning resource not found');

    // Direct S3 client usage
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');
    const { s3Client } = await import('../storage/s3StorageProvider');
    const getCmd = new GetObjectCommand({ Bucket: process.env['STORAGE_BUCKET']!, Key: resource.storageKey });
    const resp = await s3Client.send(getCmd);
    const bufferChunks: Uint8Array[] = [];
    for await (const chunk of (resp.Body as any)) {
      bufferChunks.push(chunk);
    }
    const fileBuffer = Buffer.concat(bufferChunks);

    // Extract text
    const { text } = await extractTextFromBuffer(fileBuffer, resource.mimeType);

    // Chunk text
    const chunksMeta = chunkText(text, {
      chunkSize: parseInt(process.env['CHUNK_SIZE'] || '1000'),
      chunkOverlap: parseInt(process.env['CHUNK_OVERLAP'] || '200'),
    });

    // Generate embeddings
    const embeddings = await generateEmbeddings(
      chunksMeta.map((c) => c.text),
      parseInt(process.env['EMBEDDING_BATCH_SIZE'] || '16')
    );

    // Build bulk operations for chunk inserts/upserts
const bulkOps = chunksMeta.map((chunk, idx) => {
  const embedding = embeddings[idx];
  if (!embedding || !Array.isArray(embedding.vector)) {
    throw new Error(`Missing embedding for chunk index ${idx}`);
  }
  const embeddingDimension = embedding.vector.length;
  return {
    updateOne: {
      filter: {
        institutionId: resource.institutionId,
        resourceId: resource._id,
        resourceVersion: resource.version ?? 1,
        chunkIndex: idx,
      },
      update: {
        $set: {
          text: chunk.text,
          pageNumber: chunk.pageNumber,
          embedding,
          embeddingModel: process.env['EMBEDDING_MODEL'] || 'default',
          embeddingDimension,
        },
        $setOnInsert: { createdAt: new Date() },
      },
      upsert: true,
    },
  };
});

// Persist chunks and complete the job atomically inside a MongoDB transaction.
    const session = await mongoose.startSession();
    await session.withTransaction(async () => {
      // Verify we still hold the lease inside the transaction
      const freshJob = await IngestionJob.findOne({ _id: jobId, processingLeaseToken: leaseToken }).session(session);
      if (!freshJob) {
        throw new Error('Lease lost during transaction');
      }

      // Write chunks (no token needed in filter because the transaction guarantees exclusive ownership)
      await ResourceChunk.bulkWrite(bulkOps, { session });

      // Mark job completed
      await IngestionJob.updateOne(
        { _id: jobId, processingLeaseToken: leaseToken },
        { $set: { status: 'completed', lastAttemptAt: new Date() } }
      ).session(session);
    });
    session.endSession();

  } catch (err) {
    const permanent = /unsupported mime|empty content/i.test((err as Error).message);
    const update: any = {
      $set: {
        status: permanent ? 'failed' : 'queued',
        failureReason: (err as Error).message,
        lastAttemptAt: new Date(),
      },
    };
    if (!permanent) {
      const backoffMinutes = Math.min(60, Math.pow(2, job.attempts) * 5);
      update.$set.nextRunAt = new Date(Date.now() + backoffMinutes * 60_000);
    }
    await IngestionJob.updateOne({ _id: jobId, processingLeaseToken: leaseToken }, update).exec();
  }
};
