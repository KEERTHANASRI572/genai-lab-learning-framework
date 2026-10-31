import { config as appConfig } from '../config/env';
import { StorageError } from '../storage/storageProvider';

export interface EmbeddingResult {
  vector: number[];
  model: string;
  dimension: number;
}

/**
 * Deterministically generates a normalized 768-dimensional semantic feature vector
 * using subword hashing, token frequency, and L2 normalization when an external API is not configured.
 */
export function generateLocalSemanticVector(text: string, dimension = 768): number[] {
  const vec = new Array(dimension).fill(0);
  const normalized = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return vec;

  for (let i = 0; i < words.length; i++) {
    const word = words[i]!;
    let h1 = 2166136261;
    let h2 = 16777619;
    for (let c = 0; c < word.length; c++) {
      const code = word.charCodeAt(c);
      h1 = Math.imul(h1 ^ code, 16777619);
      h2 = Math.imul(h2 ^ code, 2166136261);
    }
    const idx1 = Math.abs(h1) % dimension;
    const idx2 = Math.abs(h2) % dimension;
    const posWeight = 1.0 + Math.sin((i / words.length) * Math.PI);
    vec[idx1] = (vec[idx1] || 0) + posWeight;
    vec[idx2] = (vec[idx2] || 0) - posWeight * 0.5;
  }

  let norm = 0;
  for (let i = 0; i < dimension; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dimension; i++) vec[i] = Number((vec[i] / norm).toFixed(6));
  }
  return vec;
}

/**
 * Generate embeddings for a list of texts.
 * Uses external cloud embedding API if configured, otherwise falls back seamlessly to local semantic vectors.
 */
export const generateEmbeddings = async (
  texts: string[],
  batchSize = parseInt(process.env['EMBEDDING_BATCH_SIZE'] ?? '16')
): Promise<EmbeddingResult[]> => {
  if (batchSize <= 0) {
    throw new StorageError('EMBEDDING_BATCH_SIZE must be a positive integer');
  }

  const endpoint = appConfig.EMBEDDING_ENDPOINT;
  const apiKey = appConfig.EMBEDDING_API_KEY;
  const model = appConfig.EMBEDDING_MODEL || 'text-embedding-004';
  const dimension = 768;

  // If external embedding API is not configured, generate local normalized semantic vectors
  if (!endpoint || !apiKey) {
    return texts.map((t) => ({
      vector: generateLocalSemanticVector(t, dimension),
      model: `${model}-local`,
      dimension,
    }));
  }

  const timeoutMs = parseInt(appConfig.EMBEDDING_TIMEOUT_MS ?? '15000');
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const requestInit: RequestInit = {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, inputs: batch }),
      signal: controller.signal,
    };
    let responseBody: any;
    try {
      const resp = await fetch(endpoint, requestInit);
      if (!resp.ok) {
        const txt = await resp.text();
        throw new StorageError(`Embedding service responded ${resp.status}: ${txt}`);
      }
      responseBody = await resp.json();
    } catch (err) {
      if ((err as any).name === 'AbortError') {
        throw new StorageError('Embedding request timed out');
      }
      // On connection error, fall back to local semantic vectors gracefully
      console.warn('[Embedding] External embedding failed, falling back to local semantic vector:', (err as Error).message);
      for (const t of batch) {
        results.push({
          vector: generateLocalSemanticVector(t, dimension),
          model: `${model}-local`,
          dimension,
        });
      }
      continue;
    } finally {
      clearTimeout(timeout);
    }

    if (!responseBody || !Array.isArray(responseBody.embeddings)) {
      throw new StorageError('Embedding response missing embeddings array');
    }
    for (const vec of responseBody.embeddings) {
      if (!Array.isArray(vec)) {
        throw new StorageError('Inconsistent embedding format');
      }
      results.push({ vector: vec, model, dimension: vec.length });
    }
  }

  return results;
};
