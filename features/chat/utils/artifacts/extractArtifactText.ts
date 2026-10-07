import {
  parseExcelXlsx,
  parsePowerPoint,
  parseWord,
} from '@/features/document-upload-provider/sources/utils/file-helpers';
import logger from '@/server/logger';

const PARSERS_BY_EXTENSION: Record<string, (buffer: Buffer) => Promise<string>> = {
  '.docx': parseWord,
  '.pptx': parsePowerPoint,
  '.xlsx': parseExcelXlsx,
};

export function canExtractArtifactText(fileExtension: string): boolean {
  return fileExtension.toLowerCase() in PARSERS_BY_EXTENSION;
}

// Returns the document text behind a binary artifact, or null when the file type has no
// parser or parsing fails. Failures are logged and never thrown: callers fall back to the
// artifact's other representations rather than failing the whole lookup.
export default async function extractArtifactText(
  artifactId: string,
  fileExtension: string,
  binaryContent: Uint8Array,
): Promise<string | null> {
  const parse = PARSERS_BY_EXTENSION[fileExtension.toLowerCase()];
  if (!parse) {
    return null;
  }
  try {
    const buffer = Buffer.isBuffer(binaryContent) ? binaryContent : Buffer.from(binaryContent);
    return await parse(buffer);
  } catch (error) {
    logger.warn('Artifact text extraction failed', { artifactId, fileExtension, error });
    return null;
  }
}
