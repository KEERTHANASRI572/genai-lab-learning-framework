// import { ChunkMeta } from './textChunker';


/**
 * Split a large string into overlapping chunks.
 * Validates parameters and guarantees progress.
 */
export const chunkText = (
  raw: string,
  {
    chunkSize = 1000,
    chunkOverlap = 200,
    pageOffsets,
  }: { chunkSize?: number; chunkOverlap?: number; pageOffsets?: number[] } = {}
): ChunkMeta[] => {
  if (typeof raw !== 'string') {
    throw new Error('Input text must be a string');
  }
  if (chunkSize <= 0) {
    throw new Error('chunkSize must be a positive integer');
  }
  if (chunkOverlap < 0 || chunkOverlap >= chunkSize) {
    throw new Error('chunkOverlap must be >=0 and < chunkSize');
  }

  const chunks: ChunkMeta[] = [];
  let start = 0;
  let idx = 0;

  while (start < raw.length) {
    const end = Math.min(start + chunkSize, raw.length);
    const text = raw.slice(start, end);
    let pageNumber: number | undefined;
    if (Array.isArray(pageOffsets) && pageOffsets.length) {
      for (let i = pageOffsets.length - 1; i >= 0; i--) {
        const offset = pageOffsets[i];

        if (typeof offset === 'number' && start >= offset) {
          pageNumber = i + 1;
          break;
        }
      }
    }
    chunks.push({ index: idx, text, pageNumber });
    idx += 1;
    if (end === raw.length) break; // last short chunk, stop to avoid infinite loop
    start = end - chunkOverlap; // ensure overlap
  }

  return chunks;
};

export interface ChunkMeta {
  index: number;
  text: string;
  pageNumber?: number;
}

