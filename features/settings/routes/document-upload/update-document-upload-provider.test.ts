import settingsRouter from '@/features/settings/routes';
import updateDocumentUploadProvider from '@/features/settings/dal/document-upload/updateDocumentUploadProvider';
import { UserRole } from '@/features/shared/types/user';
import { DocumentUploadProviderType } from '@/features/shared/types/document-upload-provider';

jest.mock('@/features/settings/dal/document-upload/updateDocumentUploadProvider');

const mockUpdate = updateDocumentUploadProvider as jest.MockedFunction<typeof updateDocumentUploadProvider>;

let adminCtx: any;
let nonAdminCtx: any;

beforeEach(() => {
  adminCtx = { userRole: UserRole.Admin };
  nonAdminCtx = { userRole: UserRole.User };
});

const validInput = {
  id: 'c2c7f050-c58f-40eb-94af-fbaecabdc6f4',
  label: 'Updated Provider',
  config: {
    providerType: DocumentUploadProviderType.AWS,
    accessKeyId: 'AKIA...',
    secretAccessKey: 'SECRET',
    sessionToken: '',
    region: 'us-east-1',
    s3Uri: 's3://bucket/key',
  },
};

describe('updateDocumentUploadProvider route', () => {
  beforeEach(jest.clearAllMocks);

  it('throws unauthorized for non-admin', async () => {
    const caller = settingsRouter.createCaller(nonAdminCtx);
    await expect(
      caller.updateDocumentUploadProvider(validInput)
    ).rejects.toThrow(/do not have permission/i);
  });

  it('calls DAL and returns sanitized provider', async () => {
    const provider = {
      id: validInput.id,
      label: validInput.label,
      config: {
        providerType: DocumentUploadProviderType.AWS,
        accessKeyId: 'AKIA...',
        secretAccessKey: 'SECRET',
        region: 'us-east-1',
        s3Uri: 's3://bucket/key',
      },
    };

    mockUpdate.mockResolvedValueOnce(provider);

    const caller = settingsRouter.createCaller(adminCtx);
    const result = await caller.updateDocumentUploadProvider(validInput);

    expect(mockUpdate).toHaveBeenCalledWith({
      id: validInput.id,
      label: validInput.label,
      config: validInput.config,
    });
    expect(result).toEqual({
      id: provider.id,
      label: provider.label,
      providerType: provider.config.providerType,
      sourceUri: provider.config.s3Uri,
    });
  });

  it('propagates DAL errors', async () => {
    mockUpdate.mockRejectedValueOnce(new Error('Error updating document upload provider'));

    const caller = settingsRouter.createCaller(adminCtx);
    await expect(
      caller.updateDocumentUploadProvider(validInput)
    ).rejects.toThrow('Error updating document upload provider');
  });
});
