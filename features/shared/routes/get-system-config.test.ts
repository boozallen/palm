import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import sharedRouter from '@/features/shared/routes/index';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';

jest.mock('@/features/shared/dal/getSystemConfig');

describe('getSystemConfigRoute', () => {
  const ctx = {
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockResult = {
    systemMessage: 'Persona: HelloWorld',
    termsOfUseHeader: 'Header',
    termsOfUseBody: 'Body',
    termsOfUseCheckboxLabel: 'CheckboxLabel',
    legalPolicyHeader: 'LegalPolicyHeader',
    legalPolicyBody: 'LegalPolicyBody',
    defaultUserGroupId: '5bef722e-4911-40a6-9f11-9f0a23bcfe4b',
    systemAiProviderModelId: '36a542ce-6580-4d74-86e5-e8b8ae2b2925',
    documentLibraryDocumentUploadProviderId: '36a542ce-6580-4d74-86e5-e8b8ae2b2925',
    featureManagementPromptGenerator: true,
    featureManagementChatSummarization: true,
    featureManagementPromptTagSuggestions: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getSystemConfig as jest.Mock).mockResolvedValue(mockResult);
  });

  it('should get complete system config response for users', async () => {
    const caller = sharedRouter.createCaller(ctx);

    await expect(caller.getSystemConfig()).resolves.toEqual(mockResult);
    expect(getSystemConfig).toHaveBeenCalled();
  });
});
