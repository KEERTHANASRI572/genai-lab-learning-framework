import pdfParse = require('pdf-parse');
import { Buffer } from 'buffer';
import zlib from 'zlib';

/**
 * Extracts plain text from word/document.xml within a .docx ZIP buffer.
 */
function extractTextFromDocxBuffer(buffer: Buffer): string {
  let pos = 0;
  while (pos < buffer.length - 4) {
    if (buffer.readUInt32LE(pos) === 0x04034b50) {
      const compressionMethod = buffer.readUInt16LE(pos + 8);
      const compressedSize = buffer.readUInt32LE(pos + 18);
      const fileNameLen = buffer.readUInt16LE(pos + 26);
      const extraLen = buffer.readUInt16LE(pos + 28);
      const fileName = buffer.toString('utf8', pos + 30, pos + 30 + fileNameLen);
      const dataStart = pos + 30 + fileNameLen + extraLen;

      if (fileName === 'word/document.xml') {
        const compressedData = buffer.subarray(dataStart, dataStart + compressedSize);
        let xmlStr = '';
        if (compressionMethod === 8) {
          xmlStr = zlib.inflateRawSync(compressedData).toString('utf8');
        } else if (compressionMethod === 0) {
          xmlStr = compressedData.toString('utf8');
        }

        // Clean XML tags into clean formatted text
        const text = xmlStr
          .replace(/<w:p[^>]*>/g, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&apos;/g, "'")
          .replace(/\n\s*\n/g, '\n')
          .trim();

        return text;
      }
      pos = dataStart + compressedSize;
    } else {
      pos++;
    }
  }
  return '';
}

/**
 * Extracts raw text from supported file formats.
 * Supported formats are limited by the whitelist in storageConfig.allowedMimeTypes.
 * Returns the extracted text and optional per-page mapping (for PDFs).
 */
export const extractTextFromBuffer = async (
  buffer: Buffer,
  mime: string
): Promise<{ text: string; pageOffsets?: number[] }> => {
  if (mime === 'application/pdf') {
    // pdf-parse returns an object with the raw text and page count via info.
    try {
      const parseFn = typeof pdfParse === 'function' ? pdfParse : (pdfParse as any)?.default || (pdfParse as any);
      const data = await parseFn(buffer);
      // pdf-parse does not provide explicit page offsets, but we can approximate
      // by splitting on form-feed character (\f) which many PDFs use as page delimiter.
      const pages = data.text.split('\f');
      const pageOffsets: number[] = [];
      let offset = 0;
      for (const p of pages) {
        pageOffsets.push(offset);
        offset += p.length;
      }
      return { text: data.text, pageOffsets };
    } catch (err) {
      throw new Error(`PDF extraction failed: ${(err as Error).message}`);
    }
  }

  // Word documents (.docx)
  if (
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mime === 'application/docx' ||
    mime === 'application/msword'
  ) {
    try {
      const text = extractTextFromDocxBuffer(buffer);
      if (text.length > 0) {
        return { text };
      }
    } catch (err) {
      throw new Error(`DOCX extraction failed: ${(err as Error).message}`);
    }
  }

  // Plain text / markdown – treat buffer as UTF-8 string.
  if (mime.startsWith('text/')) {
    return { text: buffer.toString('utf-8') };
  }

  throw new Error(`Unsupported MIME type for extraction: ${mime}`);
};
