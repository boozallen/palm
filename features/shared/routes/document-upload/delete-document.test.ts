import { ContextType } from '@/server/trpc-context';
import sharedRouter from '@/features/shared/routes';
import deleteDocument from '@/features/shared/dal/document-upload/deleteDocument';
import getDocument from '@/features/shared/dal/document-upload/getDocument';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import logger from '@/server/logger';

jest.mock('@/features/shared/dal/document-upload/getDocument');
jest.mock('@/features/shared/dal/document-upload/deleteDocument');

describe('deleteDocument', () => {
  const mockUserId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
  const mockInput = 'd72f155f-7b9a-4ff5-9f08-7c7f0c02f93e';

  const ctx = {
    userId: mockUserId,
    logger,
  } as unknown as ContextType;

  const mockDeleteDocumentReturn = {
    id: mockInput,
  };

  const mockDocument = {
    id: mockInput,
    userId: mockUserId,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should delete document if user is the owner', async () => {
    (deleteDocument as jest.Mock).mockResolvedValue(mockDeleteDocumentReturn);
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.deleteDocument({ documentId: mockInput })).resolves.toEqual(
      mockDeleteDocumentReturn
    );

    expect(getDocument).toBeCalledWith(mockInput);
    expect(deleteDocument).toBeCalledWith(mockInput);
  });

  it('should throw error if user is not the owner', async () => {
    const ctxNonOwner = {
      userId: 'another-user-id',
      logger,
    } as unknown as ContextType;

    (getDocument as jest.Mock).mockResolvedValue(mockDocument);

    const caller = sharedRouter.createCaller(ctxNonOwner);
    await expect(caller.deleteDocument({ documentId: mockInput })).rejects.toThrow(
      Forbidden('You do not have permission to delete this document')
    );
    expect(logger.error).toHaveBeenCalled();

    expect(getDocument).toBeCalledWith(mockInput);
    expect(deleteDocument).not.toBeCalled();
  });
});
