import { DocumentUploadProviderType } from '@/features/shared/types';
import { UserRole } from '@/features/shared/types/user';
import getDocumentUploadProviders from '@/features/settings/dal/document-upload/getDocumentUploadProviders';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import { randomUUID } from 'crypto';

jest.mock('@/features/settings/dal/document-upload/getDocumentUploadProviders');
jest.mock('@/libs/featureFlags');

describe('getDocumentUploadProviders route', () => {
  const mockProviderFromDal = {
    id: randomUUID(),
    label: 'Provider 1',
    config: {
      providerType: DocumentUploadProviderType.AWS,
      s3Uri: 's3://bucket/key',
      bucket: 'bucket',
      region: 'us-east-1',
    },
  };

  const mockSanitizedProvider = {
    id: mockProviderFromDal.id,
    label: 'Provider 1',
    providerType: DocumentUploadProviderType.AWS,
    sourceUri: 's3://bucket/key',
  };

  const ctx = {
    userRole: UserRole.Admin,
    userId: 'user-id',
  } as unknown as ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx.userRole = UserRole.Admin;

    (getDocumentUploadProviders as jest.Mock).mockResolvedValue([mockProviderFromDal]);
  });

  it('should return sanitized document upload providers if user is Admin', async () => {
    const caller = settingsRouter.createCaller(ctx);
    const result = await caller.getDocumentUploadProviders();

    expect(result).toEqual({
      providers: [mockSanitizedProvider],
    });

    expect(getDocumentUploadProviders).toHaveBeenCalled();
  });

  it('should throw a Forbidden error if user is not Admin', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);

    await expect(caller.getDocumentUploadProviders()).rejects.toThrow(
      Forbidden('You do not have permission to access this resource.')
    );

    expect(getDocumentUploadProviders).not.toHaveBeenCalled();
  });
});
