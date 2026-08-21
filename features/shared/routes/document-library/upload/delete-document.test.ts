import { ContextType } from '@/server/trpc-context';
import sharedRouter from '@/features/shared/routes';
import deleteDocument from '@/features/shared/dal/document-library/upload/deleteDocument';
import getDocument from '@/features/shared/dal/document-library/upload/getDocument';
import getActiveGraphBuilds from '@/features/graph-database/dal/getActiveGraphBuilds';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { UserRole } from '@/features/shared/types/user';
import logger from '@/server/logger';
import { GraphBuildStatus } from '@/features/graph-database/types';

jest.mock('@/features/shared/dal/document-library/upload/getDocument');
jest.mock('@/features/shared/dal/document-library/upload/deleteDocument');
jest.mock('@/features/graph-database/dal/getActiveGraphBuilds');

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

  it('should delete document if user is the owner and document is not graphing', async () => {
    (deleteDocument as jest.Mock).mockResolvedValue(mockDeleteDocumentReturn);
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getActiveGraphBuilds as jest.Mock).mockResolvedValue([]);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.deleteDocument({ documentId: mockInput })).resolves.toEqual(
      mockDeleteDocumentReturn
    );

    expect(getDocument).toBeCalledWith(mockInput);
    expect(getActiveGraphBuilds).toBeCalledWith(mockUserId);
    expect(deleteDocument).toBeCalledWith(mockInput);
  });

  it('should throw error if user is not the owner and not an admin', async () => {
    const ctxNonOwner = {
      userId: 'another-user-id',
      userRole: UserRole.User,
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

  it('should allow admin to delete any document', async () => {
    const ctxAdmin = {
      userId: 'admin-user-id',
      userRole: UserRole.Admin,
      logger,
    } as unknown as ContextType;

    (deleteDocument as jest.Mock).mockResolvedValue(mockDeleteDocumentReturn);
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getActiveGraphBuilds as jest.Mock).mockResolvedValue([]);

    const caller = sharedRouter.createCaller(ctxAdmin);
    await expect(caller.deleteDocument({ documentId: mockInput })).resolves.toEqual(
      mockDeleteDocumentReturn
    );

    expect(getDocument).toBeCalledWith(mockInput);
    expect(getActiveGraphBuilds).toBeCalledWith('admin-user-id');
    expect(deleteDocument).toBeCalledWith(mockInput);
  });

  it('should allow admin to delete admin-created documents', async () => {
    const ctxAdmin = {
      userId: 'admin-user-id',
      userRole: UserRole.Admin,
      logger,
    } as unknown as ContextType;

    const adminDocument = {
      id: mockInput,
      userId: mockUserId,
      adminCreated: true,
    };

    (deleteDocument as jest.Mock).mockResolvedValue(mockDeleteDocumentReturn);
    (getDocument as jest.Mock).mockResolvedValue(adminDocument);
    (getActiveGraphBuilds as jest.Mock).mockResolvedValue([]);

    const caller = sharedRouter.createCaller(ctxAdmin);
    await expect(caller.deleteDocument({ documentId: mockInput })).resolves.toEqual(
      mockDeleteDocumentReturn
    );

    expect(getDocument).toBeCalledWith(mockInput);
    expect(getActiveGraphBuilds).toBeCalledWith('admin-user-id');
    expect(deleteDocument).toBeCalledWith(mockInput);
  });

  it('should throw error if document is currently being graphed', async () => {
    const activeGraphBuild = {
      graphId: 'test-graph-id',
      documentIds: [mockInput, 'other-doc-id'],
      status: GraphBuildStatus.Building,
      progress: 50,
      currentStep: 'extracting entities',
    };

    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getActiveGraphBuilds as jest.Mock).mockResolvedValue([activeGraphBuild]);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.deleteDocument({ documentId: mockInput })).rejects.toThrow(
      Forbidden('Cannot delete document while it is being graphed')
    );
    expect(logger.error).toHaveBeenCalled();

    expect(getDocument).toBeCalledWith(mockInput);
    expect(getActiveGraphBuilds).toBeCalledWith(mockUserId);
    expect(deleteDocument).not.toBeCalled();
  });

  it('should allow deletion if document is not in any active graph builds', async () => {
    const activeGraphBuild = {
      graphId: 'test-graph-id',
      documentIds: ['other-doc-id-1', 'other-doc-id-2'],
      status: GraphBuildStatus.Building,
      progress: 50,
      currentStep: 'extracting entities',
    };

    (deleteDocument as jest.Mock).mockResolvedValue(mockDeleteDocumentReturn);
    (getDocument as jest.Mock).mockResolvedValue(mockDocument);
    (getActiveGraphBuilds as jest.Mock).mockResolvedValue([activeGraphBuild]);

    const caller = sharedRouter.createCaller(ctx);
    await expect(caller.deleteDocument({ documentId: mockInput })).resolves.toEqual(
      mockDeleteDocumentReturn
    );

    expect(getDocument).toBeCalledWith(mockInput);
    expect(getActiveGraphBuilds).toBeCalledWith(mockUserId);
    expect(deleteDocument).toBeCalledWith(mockInput);
  });
});
