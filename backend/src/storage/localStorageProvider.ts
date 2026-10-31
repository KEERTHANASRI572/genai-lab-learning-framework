import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { IStorageProvider, StorageError } from './storageProvider';

export class LocalStorageProvider implements IStorageProvider {
  private baseDir: string;

  constructor(customBaseDir?: string) {
    if (customBaseDir) {
      this.baseDir = customBaseDir;
    } else {
      const backendDir = path.resolve(__dirname, '../../uploads/storage');
      const rootDir = path.resolve(process.cwd(), 'backend', 'uploads', 'storage');
      const cwdDir = path.resolve(process.cwd(), 'uploads', 'storage');

      if (fsSync.existsSync(backendDir)) {
        this.baseDir = backendDir;
      } else if (fsSync.existsSync(rootDir)) {
        this.baseDir = rootDir;
      } else {
        this.baseDir = cwdDir;
      }
    }
  }

  private getFilePath(key: string): string {
    // Sanitize key to prevent path traversal
    const safeKey = key.replace(/^[/\\]+/, '').replace(/\.\.[/\\]/g, '');
    const primary = path.join(this.baseDir, safeKey);
    if (fsSync.existsSync(primary)) {
      return primary;
    }
    // Check fallback locations
    const fallbacks = [
      path.resolve(__dirname, '../../uploads/storage', safeKey),
      path.resolve(process.cwd(), 'backend', 'uploads', 'storage', safeKey),
      path.resolve(process.cwd(), 'uploads', 'storage', safeKey),
    ];
    for (const fb of fallbacks) {
      if (fsSync.existsSync(fb)) {
        return fb;
      }
    }
    return primary;
  }

  async upload(
    key: string,
    body: Buffer,
    _contentType: string,
    _metadata?: Record<string, string>
  ): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      await fs.writeFile(filePath, body);
    } catch (err: unknown) {
      throw new StorageError(`Failed to store object locally: ${(err as Error).message}`);
    }
  }

  async getSignedDownloadUrl(key: string, _expiresInSeconds = 900): Promise<string> {
    try {
      const filePath = this.getFilePath(key);
      await fs.access(filePath);
      // Return local API route for serving file
      return `/api/v1/learning-resources/file/${encodeURIComponent(key)}`;
    } catch (err: unknown) {
      throw new StorageError(`Local object not found or inaccessible: ${(err as Error).message}`);
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const filePath = this.getFilePath(key);
      await fs.unlink(filePath).catch(() => {});
    } catch (err: unknown) {
      throw new StorageError(`Failed to delete local object: ${(err as Error).message}`);
    }
  }

  async getBuffer(key: string): Promise<Buffer> {
    try {
      const filePath = this.getFilePath(key);
      return await fs.readFile(filePath);
    } catch (err: unknown) {
      throw new StorageError(`Local object not found or unreadable: ${(err as Error).message}`);
    }
  }

  async checkHealth(): Promise<void> {
    try {
      await fs.mkdir(this.baseDir, { recursive: true });
      await fs.access(this.baseDir);
    } catch (err: unknown) {
      throw new StorageError(`Local storage health check failed: ${(err as Error).message}`);
    }
  }

  getLocalFilePath(key: string): string {
    return this.getFilePath(key);
  }
}

