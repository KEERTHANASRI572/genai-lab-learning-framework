import { IStorageProvider, StorageError } from './storageProvider';
import { LocalStorageProvider } from './localStorageProvider';
import { S3StorageProvider } from './s3StorageProvider';

let providerInstance: IStorageProvider | null = null;

export function getStorageProvider(): IStorageProvider {
  if (providerInstance) {
    return providerInstance;
  }

  const storageBackend = process.env['STORAGE_PROVIDER'] || (process.env['STORAGE_BUCKET'] ? 's3' : 'local');

  let instance: IStorageProvider;

  if (storageBackend === 's3') {
    if (!process.env['STORAGE_BUCKET']) {
      throw new StorageError('[CONFIG] STORAGE_BUCKET is required when STORAGE_PROVIDER=s3');
    }
    instance = new S3StorageProvider();
  } else if (storageBackend === 'local') {
    instance = new LocalStorageProvider();
  } else {
    throw new StorageError(`[CONFIG] Unsupported STORAGE_PROVIDER: "${storageBackend}". Valid options are "local" or "s3".`);
  }

  providerInstance = instance;
  return instance;
}
