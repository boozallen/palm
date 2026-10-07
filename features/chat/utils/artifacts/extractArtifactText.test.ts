import extractArtifactText, {
  canExtractArtifactText,
} from '@/features/chat/utils/artifacts/extractArtifactText';
import {
  parseExcelXlsx,
  parsePowerPoint,
  parseWord,
} from '@/features/document-upload-provider/sources/utils/file-helpers';
import logger from '@/server/logger';

jest.mock('@/features/document-upload-provider/sources/utils/file-helpers', () => ({
  parseWord: jest.fn(),
  parsePowerPoint: jest.fn(),
  parseExcelXlsx: jest.fn(),
}));
jest.mock('@/server/logger');

const bytes = new Uint8Array([80, 75, 3, 4]);

describe('extractArtifactText', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each([
    ['.docx', parseWord],
    ['.pptx', parsePowerPoint],
    ['.xlsx', parseExcelXlsx],
    ['.DOCX', parseWord],
  ])('routes %s to its parser and returns the text', async (fileExtension, parser) => {
    (parser as jest.Mock).mockResolvedValue('document text');

    await expect(extractArtifactText('artifact-1', fileExtension, bytes))
      .resolves.toBe('document text');
    expect(parser).toHaveBeenCalledWith(Buffer.from(bytes));
  });

  it('returns null for file types without a parser', async () => {
    await expect(extractArtifactText('artifact-1', '.mp4', bytes)).resolves.toBeNull();
    expect(parseWord).not.toHaveBeenCalled();
    expect(parsePowerPoint).not.toHaveBeenCalled();
    expect(parseExcelXlsx).not.toHaveBeenCalled();
  });

  it('returns null and logs when the parser fails', async () => {
    const error = new Error('corrupt file');
    (parseWord as jest.Mock).mockRejectedValue(error);

    await expect(extractArtifactText('artifact-1', '.docx', bytes)).resolves.toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      'Artifact text extraction failed',
      { artifactId: 'artifact-1', fileExtension: '.docx', error },
    );
  });

  it('reports which file types can be extracted', () => {
    expect(canExtractArtifactText('.docx')).toBe(true);
    expect(canExtractArtifactText('.XLSX')).toBe(true);
    expect(canExtractArtifactText('.pdf')).toBe(false);
    expect(canExtractArtifactText('')).toBe(false);
  });
});
