import getSystemConfig from './getSystemConfig';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  systemConfig: {
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
}));

const defaultMessage = 'Persona: You are a helpful assistant';

const systemConfigRecord = {
  systemMessage: defaultMessage,
  termsOfUseHeader: null,
  termsOfUseBody: null,
  termsOfUseCheckboxLabel: null,
  legalPolicyHeader: null,
  legalPolicyBody: null,
  joinUserGroupDialogExternalLink: null,
  defaultUserGroupId: null,
  systemAiProviderModelId: null,
  knowledgeGraphAiProviderModelId: null,
  knowledgeGraphEntityResolutionEnabled: null,
  memoryEnabled: null,
  documentLibraryDocumentUploadProviderId: null,
  documentLibraryDataSharingEnabled: null,
  featureManagementPromptGenerator: null,
  featureManagementChatSummarization: null,
  featureManagementPromptTagSuggestions: null,
};

describe('getSystemConfig', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully retrieves system config when it exists', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue(systemConfigRecord);

    const config = await getSystemConfig();

    expect(config).toEqual(systemConfigRecord);
    expect(db.systemConfig.findFirst).toHaveBeenCalledTimes(1);
    expect(db.systemConfig.count).not.toHaveBeenCalled();
    expect(db.systemConfig.create).not.toHaveBeenCalled();
  });

  it('creates and retrieves default system config when none exists', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue(null);
    (db.systemConfig.count as jest.Mock).mockResolvedValue(0);
    (db.systemConfig.create as jest.Mock).mockResolvedValue(systemConfigRecord);

    const config = await getSystemConfig();

    expect(config).toEqual(systemConfigRecord);
    expect(db.systemConfig.findFirst).toHaveBeenCalledTimes(1);
    expect(db.systemConfig.count).toHaveBeenCalledTimes(1);
    expect(db.systemConfig.create).toHaveBeenCalledTimes(1);
  });

  it('does not create a record when findFirst returns null but a config already exists', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockResolvedValue(null);
    (db.systemConfig.count as jest.Mock).mockResolvedValue(1);

    const config = await getSystemConfig();

    expect(db.systemConfig.count).toHaveBeenCalledTimes(1);
    expect(db.systemConfig.create).not.toHaveBeenCalled();
    expect(config).toEqual({
      systemMessage: undefined,
      termsOfUseHeader: undefined,
      termsOfUseBody: undefined,
      termsOfUseCheckboxLabel: undefined,
      legalPolicyHeader: undefined,
      legalPolicyBody: undefined,
      joinUserGroupDialogExternalLink: undefined,
      defaultUserGroupId: undefined,
      systemAiProviderModelId: undefined,
      knowledgeGraphAiProviderModelId: undefined,
      knowledgeGraphEntityResolutionEnabled: undefined,
      memoryEnabled: undefined,
      documentLibraryDocumentUploadProviderId: undefined,
      documentLibraryDataSharingEnabled: undefined,
      featureManagementPromptGenerator: undefined,
      featureManagementChatSummarization: undefined,
      featureManagementPromptTagSuggestions: undefined,
    });
  });

  it('throws a sanitized error when the query fails', async () => {
    (db.systemConfig.findFirst as jest.Mock).mockRejectedValue(new Error('db exploded'));

    await expect(getSystemConfig()).rejects.toThrow('Error getting System Config');
  });
});
