import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadBucketCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StorageError, IStorageProvider } from './storageProvider';

let cachedClient: S3Client | null = null;

export function getS3Client(): S3Client {
  if (cachedClient) return cachedClient;

  const bucket = process.env['STORAGE_BUCKET'];
  if (!bucket) {
    throw new StorageError('[CONFIG] STORAGE_BUCKET is required for S3 storage provider');
  }

  cachedClient = new S3Client({
    region: process.env['STORAGE_REGION'] || 'us-east-1',
    endpoint: process.env['STORAGE_ENDPOINT_URL'] || undefined,
    credentials: {
      accessKeyId: process.env['STORAGE_ACCESS_KEY_ID'] || '',
      secretAccessKey: process.env['STORAGE_SECRET_ACCESS_KEY'] || '',
    },
    forcePathStyle: !!process.env['STORAGE_ENDPOINT_URL'],
  });

  return cachedClient;
}

export const s3Client = new Proxy({} as S3Client, {
  get(_target, prop) {
    const client = getS3Client();
    const val = (client as any)[prop];
    return typeof val === 'function' ? val.bind(client) : val;
  },
});

export class S3StorageProvider implements IStorageProvider {
  private get bucket(): string {
    const b = process.env['STORAGE_BUCKET'];
    if (!b) {
      throw new StorageError('[CONFIG] STORAGE_BUCKET is required for S3 storage operations');
    }
    return b;
  }

  async upload(key: string, body: Buffer, contentType: string, metadata?: Record<string, string>): Promise<void> {
    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      });
      await getS3Client().send(command);
    } catch (err: unknown) {
      throw new StorageError(`Failed to upload object to S3: ${(err as Error).message}`);
    }
  }

  async getSignedDownloadUrl(key: string, expiresInSeconds = 900): Promise<string> {
    try {
      const getCommand = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      return await getSignedUrl(getS3Client(), getCommand, { expiresIn: expiresInSeconds });
    } catch (err: unknown) {
      throw new StorageError(`Failed to generate S3 signed URL: ${(err as Error).message}`);
    }
  }

  async getBuffer(key: string): Promise<Buffer> {
    try {
      const getCommand = new GetObjectCommand({ Bucket: this.bucket, Key: key });
      const resp = await getS3Client().send(getCommand);
      const bufferChunks: Uint8Array[] = [];
      for await (const chunk of (resp.Body as any)) {
        bufferChunks.push(chunk);
      }
      return Buffer.concat(bufferChunks);
    } catch (err: unknown) {
      throw new StorageError(`Failed to retrieve object from S3: ${(err as Error).message}`);
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({ Bucket: this.bucket, Key: key });
      await getS3Client().send(command);
    } catch (err: unknown) {
      throw new StorageError(`Failed to delete object from S3: ${(err as Error).message}`);
    }
  }

  async checkHealth(): Promise<void> {
    try {
      const command = new HeadBucketCommand({ Bucket: this.bucket });
      await getS3Client().send(command);
    } catch (err: unknown) {
      throw new StorageError(`S3 storage health check failed: ${(err as Error).message}`);
    }
  }
}
