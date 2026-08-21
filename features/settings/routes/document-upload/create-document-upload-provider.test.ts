import settingsRouter from '@/features/settings/routes';
import createDocumentUploadProvider from '@/features/settings/dal/document-upload/createDocumentUploadProvider';
import { UserRole } from '@/features/shared/types/user';
import { DocumentUploadProviderType } from '@/features/shared/types/document-upload-provider';

jest.mock('@/features/settings/dal/document-upload/createDocumentUploadProvider');

const mockCreate = createDocumentUploadProvider as jest.MockedFunction<typeof createDocumentUploadProvider>;

let adminCtx: any;
let nonAdminCtx: any;

beforeEach(() => {
  adminCtx = { userRole: UserRole.Admin };
  nonAdminCtx = { userRole: UserRole.User };
});

const validInput = {
  label: 'Test Provider',
  config: {
    providerType: DocumentUploadProviderType.AWS,
    accessKeyId: 'AKIA...',
    secretAccessKey: 'SECRET',
    sessionToken: '',
    region: 'us-east-1',
    s3Uri: 's3://bucket/key',
  },
};

describe('createDocumentUploadProvider route', () => {
  beforeEach(jest.clearAllMocks);

  it('throws unauthorized for non-admin', async () => {
    const caller = settingsRouter.createCaller(nonAdminCtx);
    await expect(
      caller.createDocumentUploadProvider(validInput)
    ).rejects.toThrow(/do not have permission/i);
  });

  it('calls DAL and returns sanitized provider', async () => {
    const provider = {
      id: 'uuid-123',
      label: validInput.label,
      config: {
        providerType: DocumentUploadProviderType.AWS,
        accessKeyId: 'AKIA...',
        secretAccessKey: 'SECRET',
        sessionToken: '',
        region: 'us-east-1',
        s3Uri: 's3://bucket/key',
      },
    };
    
    mockCreate.mockResolvedValueOnce(provider);

    const caller = settingsRouter.createCaller(adminCtx);
    const result = await caller.createDocumentUploadProvider(validInput);
    expect(mockCreate).toHaveBeenCalledWith({
      label: validInput.label,
      config: {
        providerType: DocumentUploadProviderType.AWS,
        accessKeyId: 'AKIA...',
        secretAccessKey: 'SECRET',
        sessionToken: '',
        region: 'us-east-1',
        s3Uri: 's3://bucket/key',
      },
    });
    expect(result).toEqual({
      id: provider.id,
      label: provider.label,
      providerType: provider.config.providerType,
      sourceUri: provider.config.s3Uri,
    });
  });

});
