import { parsePdf, parseWord, parsePlainText, parseExcelXlsx } from './file-helpers';
import logger from '@/server/logger';

jest.mock('pdf-parse', () => {
  return jest.fn().mockImplementation((buffer) => {
    if (buffer.length === 0) {
      throw new Error('Empty buffer');
    }
    if (buffer.toString().includes('problematic')) {
      return Promise.resolve({ text: 'Mocked PDF content\x00with null bytes\x01and control\x02characters' });
    }
    return Promise.resolve({ text: 'Mocked PDF content with structured text and metadata' });
  });
});

jest.mock('mammoth', () => ({
  extractRawText: jest.fn().mockImplementation(({ buffer }) => {
    if (buffer.length === 0) {
      throw new Error('Empty buffer');
    }
    return Promise.resolve({ value: 'Mocked Word content with headers, paragraphs, and lists' });
  }),
}));

jest.mock('exceljs', () => ({
  Workbook: jest.fn().mockImplementation(() => {
    const mockWorksheets = [
      {
        name: 'Sheet1',
        eachRow: jest.fn().mockImplementation((options, callback) => {
          callback({ values: [undefined, 'Name', 'Age'] });
          callback({ values: [undefined, 'John', 25] });
          callback({ values: [undefined, 'Jane', 30] });
        }),
      },
      {
        name: 'Sheet2',
        eachRow: jest.fn().mockImplementation((options, callback) => {
          callback({ values: [undefined, 'Product', 'Price'] });
          callback({ values: [undefined, 'Widget', 10.99] });
        }),
      },
    ];

    return {
      xlsx: {
        load: jest.fn().mockImplementation(async (buffer) => {
          if (buffer.length === 0) {
            throw new Error('Empty buffer');
          }
          return Promise.resolve();
        }),
      },
      worksheets: mockWorksheets,
    };
  }),
}));

describe('parsePdf', () => {
  it('should parse PDF buffer to text', async () => {
    const mockBuffer = Buffer.from('%PDF-1.4\n%Fake PDF content with structured text and metadata');
    const result = await parsePdf(mockBuffer);
    expect(result).toBe('Mocked PDF content with structured text and metadata');
  });

  it('should sanitize PDF text containing null bytes and control characters', async () => {
    const mockBuffer = Buffer.from('problematic pdf content');
    const result = await parsePdf(mockBuffer);
    expect(result).toBe('Mocked PDF contentwith null bytesand controlcharacters');
  });

  it('should throw a generic error and log the specific error if PDF parsing fails', async () => {
    const emptyBuffer = Buffer.from('');
    await expect(parsePdf(emptyBuffer)).rejects.toThrow('Failed to parse PDF');
    expect(logger.error).toHaveBeenCalledWith('PDF parsing error: Empty buffer');
  });
});

describe('parseWord', () => {
  it('should parse Word document buffer to text', async () => {
    const mockBuffer = Buffer.from('Fake Word content with headers, paragraphs, and lists');
    const result = await parseWord(mockBuffer);
    expect(result).toBe('Mocked Word content with headers, paragraphs, and lists');
  });

  it('should throw a generic error and log the specific error if Word parsing fails', async () => {
    const emptyBuffer = Buffer.from('');
    await expect(parseWord(emptyBuffer)).rejects.toThrow('Failed to parse Word document');
    expect(logger.error).toHaveBeenCalledWith('Word document parsing error: Empty buffer');
  });
});

describe('parseExcelXlsx', () => {
  it('should parse Excel buffer with multiple sheets to CSV text', async () => {
    const mockBuffer = Buffer.from('Mock Excel content');
    const result = await parseExcelXlsx(mockBuffer);

    const expectedOutput = `=== Sheet name: Sheet1 ===
Name,Age
John,25
Jane,30

=== Sheet name: Sheet2 ===
Product,Price
Widget,10.99`;

    expect(result).toBe(expectedOutput);
  });

  it('should parse Excel buffer with single sheet without sheet headers', async () => {
    const Excel = require('exceljs');

    // Mock single sheet workbook
    Excel.Workbook.mockImplementationOnce(() => ({
      xlsx: {
        load: jest.fn().mockResolvedValue(undefined),
      },
      worksheets: [{
        name: 'Sheet1',
        eachRow: jest.fn().mockImplementation((options, callback) => {
          callback({ values: [undefined, 'Single', 'Sheet'] });
          callback({ values: [undefined, 'Test', 'Data'] });
        }),
      }],
    }));

    const mockBuffer = Buffer.from('Mock Excel content');
    const result = await parseExcelXlsx(mockBuffer);

    expect(result).toBe('Single,Sheet\nTest,Data');
  });

  it('should handle empty Excel sheets gracefully', async () => {
    const Excel = require('exceljs');

    Excel.Workbook.mockImplementationOnce(() => ({
      xlsx: {
        load: jest.fn().mockResolvedValue(undefined),
      },
      worksheets: [{
        name: 'EmptySheet',
        eachRow: jest.fn().mockImplementation((options, callback) => {
          // No rows to iterate
        }),
      }],
    }));

    const mockBuffer = Buffer.from('Mock Excel content');
    const result = await parseExcelXlsx(mockBuffer);

    expect(result).toBe('');
  });

  it('should throw a generic error and log the specific error if Excel parsing fails', async () => {
    const emptyBuffer = Buffer.from('');
    await expect(parseExcelXlsx(emptyBuffer)).rejects.toThrow('Failed to parse Excel file');
    expect(logger.error).toHaveBeenCalledWith('Excel file parsing error: Empty buffer');
  });

  it('should handle Excel parsing errors gracefully', async () => {
    const Excel = require('exceljs');

    Excel.Workbook.mockImplementationOnce(() => ({
      xlsx: {
        load: jest.fn().mockRejectedValue(new Error('Invalid Excel format')),
      },
      worksheets: [],
    }));

    const mockBuffer = Buffer.from('Invalid Excel content');
    await expect(parseExcelXlsx(mockBuffer)).rejects.toThrow('Failed to parse Excel file');
    expect(logger.error).toHaveBeenCalledWith('Excel file parsing error: Invalid Excel format');
  });

  it('should handle row processing errors', async () => {
    const Excel = require('exceljs');

    Excel.Workbook.mockImplementationOnce(() => ({
      xlsx: {
        load: jest.fn().mockResolvedValue(undefined),
      },
      worksheets: [{
        name: 'Sheet1',
        eachRow: jest.fn().mockImplementation(() => {
          throw new Error('Row processing failed');
        }),
      }],
    }));

    const mockBuffer = Buffer.from('Mock Excel content');
    await expect(parseExcelXlsx(mockBuffer)).rejects.toThrow('Failed to parse Excel file');
    expect(logger.error).toHaveBeenCalledWith('Excel file parsing error: Row processing failed');
  });
});

describe('parsePlainText', () => {
  it('should parse plain text buffer to UTF-8 string', async () => {
    const textContent = 'Sample plain text content with special characters: àáâãäå';
    const mockBuffer = Buffer.from(textContent, 'utf-8');
    const result = await parsePlainText(mockBuffer);
    expect(result).toBe(textContent);
  });

  it('should handle empty buffer and return empty string', async () => {
    const emptyBuffer = Buffer.from('');
    const result = await parsePlainText(emptyBuffer);
    expect(result).toBe('');
  });

  it('should parse multiline text content correctly', async () => {
    const multilineText = 'Line 1\nLine 2\r\nLine 3\n\nLine 5';
    const mockBuffer = Buffer.from(multilineText, 'utf-8');
    const result = await parsePlainText(mockBuffer);
    expect(result).toBe(multilineText);
  });

  it('should handle text with various unicode characters', async () => {
    const unicodeText = 'Hello 世界 🌍 Emojis and unicode: ñáéíóú çüñ';
    const mockBuffer = Buffer.from(unicodeText, 'utf-8');
    const result = await parsePlainText(mockBuffer);
    expect(result).toBe(unicodeText);
  });

  it('should throw a generic error and log the specific error if text parsing fails', async () => {
    // Mock Buffer.toString to throw an error
    const mockBuffer = Buffer.from('test content');
    const originalToString = mockBuffer.toString;
    mockBuffer.toString = jest.fn().mockImplementation(() => {
      throw new Error('Buffer conversion failed');
    });

    await expect(parsePlainText(mockBuffer)).rejects.toThrow('Failed to parse text file');
    expect(logger.error).toHaveBeenCalledWith('Text file parsing error: Buffer conversion failed');

    // Restore original toString method
    mockBuffer.toString = originalToString;
  });
});
