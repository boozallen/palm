import { UserRole } from '@/features/shared/types/user';
import deleteDocumentUploadProvider from '@/features/settings/dal/document-upload/deleteDocumentUploadProvider';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { DocumentUploadProviderType } from '@/features/shared/types';

jest.mock('@/features/settings/dal/document-upload/deleteDocumentUploadProvider');

const mockDalProvider = {
  id: '00000000-0000-0000-0000-000000000001',
  label: 'Test provider',
  config: {
    providerType: DocumentUploadProviderType.AWS,
    accessKeyId: 'AKIA....',
    secretAccessKey: 'secretAccessKey',
    region: 'us-east-1',
    s3Ur: 's3://test-bucket',
  },
};

describe('deleteDocumentUploadProvider route', () => {
  const providerId = mockDalProvider.id;
  const ctx = {
    userRole: UserRole.Admin,
    userId: 'user-id',
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx.userRole = UserRole.Admin;

    (deleteDocumentUploadProvider as jest.Mock).mockResolvedValue(mockDalProvider);
  });

  it('should delete provider if user is Admin', async () => {
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.deleteDocumentUploadProvider({ providerId });

    expect(result).toEqual({ providerId: mockDalProvider.id });
    expect(deleteDocumentUploadProvider).toHaveBeenCalledWith(providerId);
  });

  it('should throw a Forbidden error if user is not Admin', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.deleteDocumentUploadProvider({ providerId })
    ).rejects.toThrow(/do not have permission/i);

    expect(deleteDocumentUploadProvider).not.toHaveBeenCalled();
  });

  it('should throw if DAL throws', async () => {
    const dalError = new Error('DAL error');
    (deleteDocumentUploadProvider as jest.Mock).mockRejectedValue(dalError);

    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.deleteDocumentUploadProvider({ providerId })
    ).rejects.toThrow('DAL error');
  });

  it('should fail input validation for invalid UUID', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await expect(
      caller.deleteDocumentUploadProvider({ providerId: 'not-a-uuid' })
    ).rejects.toThrow();
    expect(deleteDocumentUploadProvider).not.toHaveBeenCalled();
  });
});
