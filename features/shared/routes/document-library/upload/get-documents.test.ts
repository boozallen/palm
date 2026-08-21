import getDocuments from '@/features/shared/dal/document-library/upload/getDocuments';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';
import { DocumentUploadStatus } from '@/features/shared/types/document';

jest.mock('@/features/shared/dal/document-library/upload/getDocuments');

describe('get-documents route', () => {
  const mockDocumentUploadProviderId = 'c54a871d-bc7c-453e-8e39-5c4ac60cc2c0';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the user\'s documents in the correct format', async () => {
    const userId = '97cc1d48-03df-4c18-9456-917c1ac78c77';
    const now = new Date();
    const mockDocs = [
      {
        id: 'd72f155f-7b9a-4ff5-9f08-7c7f0c02f93e',
        userId: userId,
        filename: 'abc.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Completed,
        text: 'Content of abc.pdf',
        adminCreated: false,
        assignedGroupIds: [],
        assignedGroupLabels: [],
        // Includes an Excel `sheets` blob the route must NOT forward.
        dataProfile: { type: 'PWS', summary: 'GSA fleet PWS', date: '2026-05-06', sheets: { Sheet1: { rowCount: 2, columns: [] } } },
      },
      {
        id: '2faed587-7de1-4389-8d4a-55193ddaf323',
        userId: userId,
        filename: 'xyz.pdf',
        createdAt: now,
        uploadStatus: DocumentUploadStatus.Pending,
        text: undefined,
        adminCreated: false,
        assignedGroupIds: [],
        assignedGroupLabels: [],
        dataProfile: null,
      },
    ];
    (getDocuments as jest.Mock).mockResolvedValue(mockDocs);

    const ctx = { userId } as ContextType;
    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getDocuments({
      documentUploadProviderId: mockDocumentUploadProviderId,
    })).resolves.toEqual({
      documents: mockDocs.map(doc => ({
        id: doc.id,
        userId: doc.userId,
        filename: doc.filename,
        createdAt: doc.createdAt,
        uploadStatus: doc.uploadStatus,
        text: doc.text,
        adminCreated: doc.adminCreated,
        assignedGroupIds: doc.assignedGroupIds,
        assignedGroupLabels: doc.assignedGroupLabels,
        // Only the metadata fields survive — never the `sheets` blob.
        dataProfile: doc.dataProfile
          ? { type: doc.dataProfile.type, summary: doc.dataProfile.summary, date: doc.dataProfile.date }
          : null,
      })),
    });

    expect(getDocuments).toHaveBeenCalledWith({
      userId,
      documentUploadProviderId: mockDocumentUploadProviderId,
    });
  });

  it('throws on internal errors from DAL', async () => {
    const userId = 'a7fa0a0b-7242-44e2-8dbb-23bbde53670f';
    (getDocuments as jest.Mock).mockRejectedValue(new Error('Some DB error'));

    const ctx = { userId } as ContextType;
    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getDocuments({
      documentUploadProviderId: mockDocumentUploadProviderId,
    })).rejects.toThrow('Some DB error');

    expect(getDocuments).toHaveBeenCalledWith({
      userId,
      documentUploadProviderId: mockDocumentUploadProviderId,
    });
  });
});
