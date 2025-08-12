import { parsePdf, parseWord, parsePlainText, parseExcel } from './file-helpers';
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

jest.mock('xlsx', () => ({
  read: jest.fn().mockImplementation((buffer, options) => {
    if (buffer.length === 0) {
      throw new Error('Empty buffer');
    }
    return {
      SheetNames: ['Sheet1', 'Sheet2'],
      Sheets: {
        Sheet1: {
          A1: { v: 'Name' },
          B1: { v: 'Age' },
          A2: { v: 'John' },
          B2: { v: 25 },
          A3: { v: 'Jane' },
          B3: { v: 30 },
        },
        Sheet2: {
          A1: { v: 'Product' },
          B1: { v: 'Price' },
          A2: { v: 'Widget' },
          B2: { v: 10.99 },
        },
      },
    };
  }),
  utils: {
    sheet_to_csv: jest.fn().mockImplementation((worksheet, options) => {
      if (worksheet === undefined) {
        throw new Error('Invalid worksheet');
      }
      // Mock different responses based on which sheet is being processed
      if (worksheet.A1?.v === 'Name') {
        return 'Name,Age\nJohn,25\nJane,30';
      } else if (worksheet.A1?.v === 'Product') {
        return 'Product,Price\nWidget,10.99';
      }
      return 'Mock,Data\nTest,Value';
    }),
  },
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

describe('parseExcel', () => {
  it('should parse Excel buffer with multiple sheets to CSV text', async () => {
    const mockBuffer = Buffer.from('Mock Excel content');
    const result = await parseExcel(mockBuffer);

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
    const XLSX = require('xlsx');

    // Mock single sheet workbook
    XLSX.read.mockImplementationOnce(() => ({
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: {
          A1: { v: 'Single' },
          B1: { v: 'Sheet' },
          A2: { v: 'Test' },
          B2: { v: 'Data' },
        },
      },
    }));

    XLSX.utils.sheet_to_csv.mockImplementationOnce(() => 'Single,Sheet\nTest,Data');

    const mockBuffer = Buffer.from('Mock Excel content');
    const result = await parseExcel(mockBuffer);

    expect(result).toBe('Single,Sheet\nTest,Data');
  });

  it('should handle empty Excel sheets gracefully', async () => {
    const XLSX = require('xlsx');

    XLSX.read.mockImplementationOnce(() => ({
      SheetNames: ['EmptySheet'],
      Sheets: {
        EmptySheet: {},
      },
    }));

    XLSX.utils.sheet_to_csv.mockImplementationOnce(() => '');

    const mockBuffer = Buffer.from('Mock Excel content');
    const result = await parseExcel(mockBuffer);

    expect(result).toBe('');
  });

  it('should throw a generic error and log the specific error if Excel parsing fails', async () => {
    const emptyBuffer = Buffer.from('');
    await expect(parseExcel(emptyBuffer)).rejects.toThrow('Failed to parse Excel file');
    expect(logger.error).toHaveBeenCalledWith('Excel file parsing error: Empty buffer');
  });

  it('should handle XLSX parsing errors gracefully', async () => {
    const XLSX = require('xlsx');

    XLSX.read.mockImplementationOnce(() => {
      throw new Error('Invalid Excel format');
    });

    const mockBuffer = Buffer.from('Invalid Excel content');
    await expect(parseExcel(mockBuffer)).rejects.toThrow('Failed to parse Excel file');
    expect(logger.error).toHaveBeenCalledWith('Excel file parsing error: Invalid Excel format');
  });

  it('should handle sheet_to_csv conversion errors', async () => {
    const XLSX = require('xlsx');

    XLSX.read.mockImplementationOnce(() => ({
      SheetNames: ['Sheet1'],
      Sheets: {
        Sheet1: { A1: { v: 'Test' } },
      },
    }));

    XLSX.utils.sheet_to_csv.mockImplementationOnce(() => {
      throw new Error('CSV conversion failed');
    });

    const mockBuffer = Buffer.from('Mock Excel content');
    await expect(parseExcel(mockBuffer)).rejects.toThrow('Failed to parse Excel file');
    expect(logger.error).toHaveBeenCalledWith('Excel file parsing error: CSV conversion failed');
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
