import db from '@/server/db';
import logger from '@/server/logger';
import createSharedDocument from './createSharedDocument';

jest.mock('@/server/db', () => ({
  sharedDocument: {
    create: jest.fn(),
  },
}));

describe('createSharedDocument dal', () => {
  const mockSourceDocumentId = 'doc-123';
  const mockSourceUserId = 'user-123';
  const mockSharedWithUserGroupIds = ['group-1', 'group-2'];
  const mockInput = {
    sourceDocumentId: mockSourceDocumentId,
    sourceUserId: mockSourceUserId,
    sharedWithUserGroupIds: mockSharedWithUserGroupIds,
  };

  const mockResult = {
    id: 'shared-doc-456',
    sourceDocumentId: mockSourceDocumentId,
    sourceUserId: mockSourceUserId,
    sharedWithUserGroupIds: mockSharedWithUserGroupIds,
    createdAt: new Date(),
    deletedAt: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a new SharedDocument successfully', async () => {
    (db.sharedDocument.create as jest.Mock).mockResolvedValue(mockResult);

    const result = await createSharedDocument(mockInput);

    expect(db.sharedDocument.create).toHaveBeenCalledWith({
      data: {
        sourceDocumentId: mockSourceDocumentId,
        sourceUserId: mockSourceUserId,
        sharedWithUserGroupIds: mockSharedWithUserGroupIds,
      },
    });

    expect(result).toEqual({
      id: mockResult.id,
      sourceDocumentId: mockResult.sourceDocumentId,
      sourceUserId: mockResult.sourceUserId,
      sharedWithUserGroupIds: mockResult.sharedWithUserGroupIds,
      createdAt: mockResult.createdAt,
      deletedAt: undefined,
    });
  });

  it('logs an error and throws an exception if an error occurs', async () => {
    const mockError = new Error('DB error');
    (db.sharedDocument.create as jest.Mock).mockRejectedValue(mockError);

    await expect(createSharedDocument(mockInput)).rejects.toThrow('Error creating shared document');
    expect(logger.error).toHaveBeenCalledWith(
      `Error creating shared document: DocumentId: ${mockSourceDocumentId}`,
      mockError
    );
  });
});
