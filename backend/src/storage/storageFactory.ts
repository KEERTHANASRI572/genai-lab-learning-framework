import { IStorageProvider, StorageError } from './storageProvider';
import { LocalStorageProvider } from './localStorageProvider';

let providerInstance: IStorageProvider | null = null;

export function getStorageProvider(): IStorageProvider {
  if (providerInstance) return providerInstance;

  const storageBackend = process.env['STORAGE_PROVIDER'] || (process.env['STORAGE_BUCKET'] ? 's3' : 'local');

  if (storageBackend === 's3') {
    if (!process.env['STORAGE_BUCKET']) {
      throw new StorageError('[CONFIG] STORAGE_BUCKET is required when STORAGE_PROVIDER=s3');
    }
    const { S3StorageProvider } = require('./s3StorageProvider');
    providerInstance = new S3StorageProvider();
    return providerInstance;
  }

  providerInstance = new LocalStorageProvider();
  return providerInstance;
}
