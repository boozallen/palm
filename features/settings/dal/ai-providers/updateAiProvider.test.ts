import updateAiProvider from './updateAiProvider';
import db from '@/server/db';
import { AiProviderType } from '@/features/shared/types';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

describe('updateAiProvider', () => {
  const aiProviderUuid: string = '50858dc4-d1c1-4680-ad97-cf2de8d34b8c';
  const apiConfigUuid: string = 'fde4f355-b5ab-49ee-b999-dd61565f6ca7';
  const mockApiKey: string = 'sk-3d88220dd1d1444b9e4f044ee220f181';
  const mockApiEndpoint: string = 'https://azureopenai.microsoft.com/api/v1/openai/text/completions';

  let inputMock = {
    id: aiProviderUuid,
    label: 'newlabel',
    inputTokenCost: undefined,
    outputTokenCost: undefined,
    apiKey: '',
    accessKeyId: '',
    secretAccessKey: '',
    sessionToken: '',
    apiEndpoint: '',
    region: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    inputMock = {
      id: aiProviderUuid,
      label: 'newlabel',
      inputTokenCost: undefined,
      outputTokenCost: undefined,
      apiKey: '',
      accessKeyId: '',
      secretAccessKey: '',
      sessionToken: '',
      apiEndpoint: '',
      region: '',
    };
  });

  // create a mock function for all the update methods
  const mockApiConfigOpenAiUpdate = jest.fn();
  const mockApiConfigAzureOpenAiUpdate = jest.fn();
  const mockApiConfigAnthropicUpdate = jest.fn();
  const mockApiConfigGeminiUpdate = jest.fn();
  const mockApiConfigBedrockUpdate = jest.fn();
  const mockAiProviderUpdate = jest.fn();
  const mockAiProviderFindUnique = jest.fn();

  (db.$transaction as jest.Mock).mockImplementation(async (prisma) => {
    return prisma({
      apiConfigOpenAi: { update: mockApiConfigOpenAiUpdate },
      apiConfigAzureOpenAi: { update: mockApiConfigAzureOpenAiUpdate },
      apiConfigAnthropic: { update: mockApiConfigAnthropicUpdate },
      apiConfigGemini: { update: mockApiConfigGeminiUpdate },
      apiConfigBedrock: { update: mockApiConfigBedrockUpdate },
      aiProvider: {
        findUnique: mockAiProviderFindUnique,
        update: mockAiProviderUpdate,
      },
    });
  });

  describe('Updates OpenAI configurations', () => {
    const aiProviderResultMock = {
      id: aiProviderUuid,
      label: 'Test Provider',
      typeId: AiProviderType.OpenAi,
      configTypeId: AiProviderType.OpenAi,
      inputTokenCost: 0,
      outputTokenCost: 0,
      aiProviderTypeId: AiProviderType.OpenAi,
      apiConfigId: apiConfigUuid,
      deletedAt: null,
    };

    beforeEach(() => {
      (mockAiProviderFindUnique).mockResolvedValue(aiProviderResultMock);

      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('successfully updates apiKey', async () => {
      inputMock = {
        ...inputMock,
        apiKey: mockApiKey,
      };

      const apiConfigResultMock = {
        id: apiConfigUuid,
        apiKey: mockApiKey,
        type: AiProviderType.OpenAi,
        orgKey: '',
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });
      (mockApiConfigOpenAiUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);

      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });

      expect(mockApiConfigOpenAiUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {
          apiKey: mockApiKey,
        },
      });

      expect(mockApiConfigAzureOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAnthropicUpdate).not.toHaveBeenCalled();
    });

    it('does not update api key if it is not provided', async () => {
      const apiConfigResultMock = {
        id: apiConfigUuid,
        apiKey: '',
        orgKey: '',
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });
      (mockApiConfigOpenAiUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);

      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });

      expect(mockApiConfigOpenAiUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {},
      });

      expect(mockApiConfigAzureOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAnthropicUpdate).not.toHaveBeenCalled();
    });
  });
  describe('Updates AzureOpenAI configurations', () => {
    const aiProviderResultMock = {
      id: aiProviderUuid,
      label: 'Test Provider',
      typeId: AiProviderType.AzureOpenAi,
      configTypeId: AiProviderType.AzureOpenAi,
      inputTokenCost: 0,
      outputTokenCost: 0,
      aiProviderTypeId: AiProviderType.AzureOpenAi,
      apiConfigId: apiConfigUuid,
      deletedAt: null,
    };

    beforeEach(() => {
      jest.clearAllMocks();

      (mockAiProviderFindUnique).mockResolvedValue(aiProviderResultMock);
    });

    it('successfully updates apiKey', async () => {
      inputMock = {
        ...inputMock,
        apiKey: mockApiKey,
        apiEndpoint: mockApiEndpoint,
      };

      const apiConfigResultMock = {
        id: apiConfigUuid,
        apiKey: mockApiKey,
        apiEndpoint: mockApiEndpoint,
        deploymentId: '',
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });
      (mockApiConfigAzureOpenAiUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);
      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });
      expect(mockApiConfigAzureOpenAiUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {
          apiKey: mockApiKey,
          apiEndpoint: mockApiEndpoint,
        },
      });

      expect(mockApiConfigOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAnthropicUpdate).not.toHaveBeenCalled();
    });

    it('does not update api key if it is not provided', async () => {
      inputMock = {
        ...inputMock,
        apiEndpoint: mockApiEndpoint,
      };

      const apiConfigResultMock = {
        id: apiConfigUuid,
        apiKey: '',
        apiEndpoint: mockApiEndpoint,
        deploymentId: '',
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });
      (mockApiConfigAzureOpenAiUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);

      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });
      expect(mockApiConfigAzureOpenAiUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {
          apiEndpoint: mockApiEndpoint,
        },
      });

      expect(mockApiConfigOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAnthropicUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Updates Anthropic configurations', () => {

    const aiProviderResultMock = {
      id: aiProviderUuid,
      label: 'Test Provider',
      typeId: AiProviderType.Anthropic,
      configTypeId: AiProviderType.Anthropic,
      inputTokenCost: 0,
      outputTokenCost: 0,
      aiProviderTypeId: AiProviderType.Anthropic,
      apiConfigId: apiConfigUuid,
      deletedAt: null,
    };

    beforeEach(() => {

      (mockAiProviderFindUnique).mockResolvedValue(aiProviderResultMock);

      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('successfully updates apiKey', async () => {
      inputMock = {
        ...inputMock,
        apiKey: mockApiKey,
      };

      const apiConfigResultMock = {
        id: apiConfigUuid,
        apiKey: mockApiKey,
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });
      (mockApiConfigAnthropicUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);

      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });

      expect(mockApiConfigAnthropicUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {
          apiKey: mockApiKey,
        },
      });

      expect(mockApiConfigOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAzureOpenAiUpdate).not.toHaveBeenCalled();
    });

    it('does not update api key if it is not provided', async () => {
      const apiConfigResultMock = {
        id: apiConfigUuid,
        apiKey: '',
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });
      (mockApiConfigAnthropicUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);

      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });

      expect(mockApiConfigAnthropicUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {},
      });

      expect(mockApiConfigOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAzureOpenAiUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Updates Gemini configurations', () => {

    const aiProviderResultMock = {
      id: aiProviderUuid,
      label: 'Test Provider',
      typeId: AiProviderType.Gemini,
      configTypeId: AiProviderType.Gemini,
      inputTokenCost: 0,
      outputTokenCost: 0,
      aiProviderTypeId: AiProviderType.Gemini,
      apiConfigId: apiConfigUuid,
      deletedAt: null,
    };

    beforeEach(() => {

      (mockAiProviderFindUnique).mockResolvedValue(aiProviderResultMock);

      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('successfully updates apiKey', async () => {
      inputMock = {
        ...inputMock,
        apiKey: mockApiKey,
      };

      const apiConfigResultMock = {
        id: apiConfigUuid,
        apiKey: mockApiKey,
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });
      (mockApiConfigGeminiUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);

      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });

      expect(mockApiConfigGeminiUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {
          apiKey: mockApiKey,
        },
      });

      expect(mockApiConfigOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAzureOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAnthropicUpdate).not.toHaveBeenCalled();
    });

    it('does not update api key if it is not provided', async () => {
      const apiConfigResultMock = {
        id: apiConfigUuid,
        apiKey: '',
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });
      (mockApiConfigGeminiUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);

      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });

      expect(mockApiConfigGeminiUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {},
      });

      expect(mockApiConfigOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAzureOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAnthropicUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Updates Bedrock configurations', () => {
    const aiProviderResultMock = {
      id: aiProviderUuid,
      label: 'Test Provider',
      typeId: AiProviderType.Bedrock,
      configTypeId: AiProviderType.Bedrock,
      inputTokenCost: 0,
      outputTokenCost: 0,
      aiProviderTypeId: AiProviderType.Bedrock,
      apiConfigId: apiConfigUuid,
      deletedAt: null,
    };

    beforeEach(() => {

      (mockAiProviderFindUnique).mockResolvedValue(aiProviderResultMock);

      jest.clearAllMocks();
    });

    afterEach(() => {
      jest.clearAllMocks();
    });

    it('successfully updates accessKeyId', async () => {
      inputMock = {
        ...inputMock,
        accessKeyId: mockApiKey,
        region: 'us-west-2',
      };

      const apiConfigResultMock = {
        id: apiConfigUuid,
        accessKeyId: mockApiKey,
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });

      (mockApiConfigBedrockUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);

      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });

      expect(mockApiConfigBedrockUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {
          accessKeyId: inputMock.accessKeyId,
          region: inputMock.region,
        },
      });

      expect(mockApiConfigOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAzureOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAnthropicUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigGeminiUpdate).not.toHaveBeenCalled();
    });

    it('successfully updates accessKeyId and secretAccessKey', async () => {
      inputMock = {
        ...inputMock,
        accessKeyId: mockApiKey,
        secretAccessKey: mockApiKey,
        region: 'us-west-2',
      };

      const apiConfigResultMock = {
        id: apiConfigUuid,
        accessKeyId: mockApiKey,
        secretAccessKey: mockApiKey,
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });

      (mockApiConfigBedrockUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);

      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });

      expect(mockApiConfigBedrockUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {
          accessKeyId: inputMock.accessKeyId,
          secretAccessKey: inputMock.secretAccessKey,
          region: inputMock.region,
        },
      });

      expect(mockApiConfigOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAzureOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAnthropicUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigGeminiUpdate).not.toHaveBeenCalled();
    });

    it('successfully updates secretAccessKey and sessionToken', async () => {
      inputMock = {
        ...inputMock,
        secretAccessKey: mockApiKey,
        sessionToken: mockApiKey,
        region: 'us-west-2',
      };

      const apiConfigResultMock = {
        id: apiConfigUuid,
        secretAccessKeyId: mockApiKey,
        sessionToken: mockApiKey,
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });

      (mockApiConfigBedrockUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);

      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });

      expect(mockApiConfigBedrockUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {
          secretAccessKey: inputMock.secretAccessKey,
          sessionToken: inputMock.sessionToken,
          region: inputMock.region,
        },
      });

      expect(mockApiConfigOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAzureOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAnthropicUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigGeminiUpdate).not.toHaveBeenCalled();
    });

    it('does not update secrets if it is not provided', async () => {
      const apiConfigResultMock = {
        id: apiConfigUuid,
        region: 'us-west-2',
      };

      (mockAiProviderUpdate).mockResolvedValueOnce({
        ...aiProviderResultMock,
        label: inputMock.label,
      });

      (mockApiConfigBedrockUpdate).mockResolvedValueOnce(apiConfigResultMock);

      await updateAiProvider(inputMock);

      expect(mockAiProviderFindUnique).toHaveBeenCalledWith({
        where: {
          id: aiProviderUuid, deletedAt: null,
        },
        select: {
          id: true,
          label: true,
          aiProviderTypeId: true,
          apiConfigId: true,
          deletedAt: true,
        },
      });

      expect(mockApiConfigBedrockUpdate).toHaveBeenCalledWith({
        where: {
          id: apiConfigUuid, deletedAt: null,
        },
        data: {
          region: inputMock.region,
        },
      });

      expect(mockApiConfigOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAzureOpenAiUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigAnthropicUpdate).not.toHaveBeenCalled();
      expect(mockApiConfigGeminiUpdate).not.toHaveBeenCalled();
    });
  });
});
