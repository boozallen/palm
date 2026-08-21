import { UserRole } from '@/features/shared/types/user';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';
import sharedRouter from '@/features/shared/routes';
import { ContextType } from '@/server/trpc-context';

jest.mock('@/features/shared/dal/getSystemConfig');

describe('getDocumentLibraryDataSharingEnabled route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCtx = {
      userId: 'test-user-id',
      userRole: UserRole.User,
    } as unknown as ContextType;
  });

  it('should return enabled: true when documentLibraryDataSharingEnabled is true', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      systemMessage: '',
      termsOfUseHeader: '',
      termsOfUseBody: '',
      termsOfUseCheckboxLabel: '',
      legalPolicyHeader: '',
      legalPolicyBody: '',
      defaultUserGroupId: null,
      systemAiProviderModelId: null,
      knowledgeGraphAiProviderModelId: null,
      documentLibraryDocumentUploadProviderId: null,
      featureManagementPromptGenerator: true,
      featureManagementChatSummarization: true,
      featureManagementPromptTagSuggestions: true,
      documentLibraryDataSharingEnabled: true,
    });

    const caller = sharedRouter.createCaller(mockCtx);
    const result = await caller.getDocumentLibraryDataSharingEnabled();

    expect(result).toEqual({ enabled: true });
    expect(getSystemConfig).toHaveBeenCalledWith();
  });

  it('should return enabled: false when documentLibraryDataSharingEnabled is false', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      systemMessage: '',
      termsOfUseHeader: '',
      termsOfUseBody: '',
      termsOfUseCheckboxLabel: '',
      legalPolicyHeader: '',
      legalPolicyBody: '',
      defaultUserGroupId: null,
      systemAiProviderModelId: null,
      knowledgeGraphAiProviderModelId: null,
      documentLibraryDocumentUploadProviderId: null,
      featureManagementPromptGenerator: true,
      featureManagementChatSummarization: true,
      featureManagementPromptTagSuggestions: true,
      documentLibraryDataSharingEnabled: false,
    });

    const caller = sharedRouter.createCaller(mockCtx);
    const result = await caller.getDocumentLibraryDataSharingEnabled();

    expect(result).toEqual({ enabled: false });
    expect(getSystemConfig).toHaveBeenCalledWith();
  });

  it('should return enabled: false when documentLibraryDataSharingEnabled is null/undefined', async () => {
    (getSystemConfig as jest.Mock).mockResolvedValue({
      systemMessage: '',
      termsOfUseHeader: '',
      termsOfUseBody: '',
      termsOfUseCheckboxLabel: '',
      legalPolicyHeader: '',
      legalPolicyBody: '',
      defaultUserGroupId: null,
      systemAiProviderModelId: null,
      knowledgeGraphAiProviderModelId: null,
      documentLibraryDocumentUploadProviderId: null,
      featureManagementPromptGenerator: true,
      featureManagementChatSummarization: true,
      featureManagementPromptTagSuggestions: true,
      documentLibraryDataSharingEnabled: undefined,
    });

    const caller = sharedRouter.createCaller(mockCtx);
    const result = await caller.getDocumentLibraryDataSharingEnabled();

    expect(result).toEqual({ enabled: false });
    expect(getSystemConfig).toHaveBeenCalledWith();
  });
});