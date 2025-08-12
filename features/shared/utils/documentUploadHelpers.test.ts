import crypto from 'crypto';

import { generateObjectKey } from './documentUploadHelpers';

jest.mock('crypto');

const mockCrypto = crypto as jest.Mocked<typeof crypto>;

describe('generateObjectKey', () => {
  const mockHmac = {
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockCrypto.createHmac = jest.fn().mockReturnValue(mockHmac as any);
  });

  it('should generate correct S3 file key for user document with hash', () => {
    const userId = 'user-123';
    const salt = 'test-salt';
    const fileName = 'test-document.pdf';
    const mockHash = 'abcdef1234567890';

    mockHmac.digest.mockReturnValue(mockHash);

    const result = generateObjectKey(userId, salt, fileName);

    expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', salt);
    expect(mockHmac.update).toHaveBeenCalledWith(userId);
    expect(mockHmac.digest).toHaveBeenCalledWith('hex');
    expect(result).toBe(`document-upload/users/${mockHash}/test-document.pdf`);
  });

  it('should handle special characters in filename', () => {
    const userId = 'user-456';
    const salt = 'test-salt';
    const fileName = 'My Document (Final Version).docx';
    const mockHash = 'fedcba0987654321';

    mockHmac.digest.mockReturnValue(mockHash);

    const result = generateObjectKey(userId, salt, fileName);

    expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', salt);
    expect(mockHmac.update).toHaveBeenCalledWith(userId);
    expect(mockHmac.digest).toHaveBeenCalledWith('hex');
    expect(result).toBe(`document-upload/users/${mockHash}/My Document (Final Version).docx`);
  });

  it('should handle different file extensions', () => {
    const userId = 'user-789';
    const salt = 'test-salt';
    const mockHash = '1234567890abcdef';

    mockHmac.digest.mockReturnValue(mockHash);

    const testCases = [
      { fileName: 'spreadsheet.xlsx', expected: `document-upload/users/${mockHash}/spreadsheet.xlsx` },
      { fileName: 'presentation.pptx', expected: `document-upload/users/${mockHash}/presentation.pptx` },
      { fileName: 'text.txt', expected: `document-upload/users/${mockHash}/text.txt` },
      { fileName: 'image.png', expected: `document-upload/users/${mockHash}/image.png` },
    ];

    testCases.forEach(({ fileName, expected }) => {
      const result = generateObjectKey(userId, salt, fileName);
      expect(result).toBe(expected);
    });

    expect(mockCrypto.createHmac).toHaveBeenCalledTimes(testCases.length);
  });

  it('should handle UUID-style user IDs', () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    const salt = 'test-uuid-salt';
    const fileName = 'document.pdf';
    const mockHash = 'uuid-hash-result';

    mockHmac.digest.mockReturnValue(mockHash);

    const result = generateObjectKey(userId, salt, fileName);

    expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', salt);
    expect(mockHmac.update).toHaveBeenCalledWith(userId);
    expect(mockHmac.digest).toHaveBeenCalledWith('hex');
    expect(result).toBe(`document-upload/users/${mockHash}/document.pdf`);
  });

  it('should produce different hashes for different salts', () => {
    const userId = 'user-123';
    const fileName = 'document.pdf';
    const salt1 = 'test-salt-one';
    const salt2 = 'test-salt-two';
    const hash1 = 'hash-for-salt-one';
    const hash2 = 'hash-for-salt-two';

    // First call with test-salt-one
    mockHmac.digest.mockReturnValueOnce(hash1);
    const result1 = generateObjectKey(userId, salt1, fileName);

    // Second call with test-salt-two
    mockHmac.digest.mockReturnValueOnce(hash2);
    const result2 = generateObjectKey(userId, salt2, fileName);

    expect(mockCrypto.createHmac).toHaveBeenNthCalledWith(1, 'sha256', salt1);
    expect(mockCrypto.createHmac).toHaveBeenNthCalledWith(2, 'sha256', salt2);
    expect(result1).toBe(`document-upload/users/${hash1}/document.pdf`);
    expect(result2).toBe(`document-upload/users/${hash2}/document.pdf`);
    expect(result1).not.toBe(result2);
  });

  it('should produce same hash for same user and salt', () => {
    const userId = 'user-123';
    const salt = 'test-consistent-salt';
    const fileName1 = 'document1.pdf';
    const fileName2 = 'document2.pdf';
    const mockHash = 'consistent-hash';

    mockHmac.digest.mockReturnValue(mockHash);

    const result1 = generateObjectKey(userId, salt, fileName1);
    const result2 = generateObjectKey(userId, salt, fileName2);

    expect(result1).toBe(`document-upload/users/${mockHash}/document1.pdf`);
    expect(result2).toBe(`document-upload/users/${mockHash}/document2.pdf`);

    // Both calls should use the same hash (different filenames, same user/salt)
    expect(mockCrypto.createHmac).toHaveBeenCalledTimes(2);
    expect(mockHmac.update).toHaveBeenCalledWith(userId);
  });
});
