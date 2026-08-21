jest.mock('@/server/logger');
jest.mock('@/server/config', () => ({
  getConfig: jest.fn(() => ({
    logLevel: 'info',
    nodeEnv: 'test',
    logFormat: 'json',
    agentServices: {
      claudeServiceUrl: 'https://agent-service.example.com',
      internalApiKey: 'test-api-key',
    },
  })),
}));

import { getTabularDataSchema } from './getTabularDataSchema';
import { logger } from '@/server/logger';

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('getTabularDataSchema', () => {
  const mockDocumentId = 'doc-123';
  const mockFileName = 'data.xlsx';
  const mockFileData = Buffer.from('test data');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return the sheets data on success', async () => {
    const mockProfile = { sheets: { Sheet1: { rowCount: 10, columns: [] } } };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, profile: mockProfile }),
    });

    const result = await getTabularDataSchema(mockDocumentId, mockFileName, mockFileData);

    expect(result).toEqual(mockProfile);
    expect(mockFetch).toHaveBeenCalledWith(
      'https://agent-service.example.com/get-schema',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-api-key',
        },
        body: JSON.stringify({
          data_b64: mockFileData.toString('base64'),
          filename: mockFileName,
        }),
      }
    );
    expect(logger.info).toHaveBeenCalledWith(
      `[DOC-UPLOAD] data schema fetched for ${mockDocumentId}`
    );
  });

  it('should return null on HTTP error response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    const result = await getTabularDataSchema(mockDocumentId, mockFileName, mockFileData);

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      `[DOC-UPLOAD] get-schema failed for ${mockDocumentId}: HTTP 500`
    );
  });

  it('should return null when service returns success: false', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: false, error: 'Invalid data format' }),
    });

    const result = await getTabularDataSchema(mockDocumentId, mockFileName, mockFileData);

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      `[DOC-UPLOAD] get-schema error for ${mockDocumentId}: Invalid data format`
    );
  });

  it('should return null and log on fetch error', async () => {
    const mockError = new Error('Network error');
    mockFetch.mockRejectedValueOnce(mockError);

    const result = await getTabularDataSchema(mockDocumentId, mockFileName, mockFileData);

    expect(result).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      `[DOC-UPLOAD] get-schema threw for ${mockDocumentId}:`,
      mockError
    );
  });

  it('should return null when profile is missing from response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const result = await getTabularDataSchema(mockDocumentId, mockFileName, mockFileData);

    expect(result).toBeNull();
  });
});
