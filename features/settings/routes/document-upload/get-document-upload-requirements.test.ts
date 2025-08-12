import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import logger from '@/server/logger';
import getFirstAvailableOpenAiModel from '@/features/settings/dal/getFirstAvailableOpenAiModel';
import { RequirementNames } from '@/features/settings/types/system-requirements';

jest.mock('@/features/settings/dal/getFirstAvailableOpenAiModel');

describe('getDocumentUploadRequirements route', () => {
  let mockCtx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    (getFirstAvailableOpenAiModel as jest.Mock).mockResolvedValue({
      id: 'gpt-4',
      externalId: 'gpt-4',
    });

    mockCtx = {
      logger: logger,
      userRole: UserRole.Admin,
    } as unknown as ContextType;
  });

  it('should return configured: true when OpenAI model is available', async () => {
    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getDocumentUploadRequirements();

    expect(result).toEqual({
      configured: true,
      requirements: [
        {
          name: RequirementNames.OPENAI_MODEL,
          available: true,
        },
      ],
    });
    expect(getFirstAvailableOpenAiModel).toHaveBeenCalled();
  });

  it('should throw an error if user is not Admin', async () => {
    mockCtx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(mockCtx);

    await expect(caller.getDocumentUploadRequirements()).rejects.toThrow();

    expect(getFirstAvailableOpenAiModel).not.toHaveBeenCalled();
  });

  it('should return configured: false when OpenAI model is not available', async () => {
    (getFirstAvailableOpenAiModel as jest.Mock).mockResolvedValue(null);

    const caller = settingsRouter.createCaller(mockCtx);
    const result = await caller.getDocumentUploadRequirements();

    expect(result).toEqual({
      configured: false,
      requirements: [
        {
          name: RequirementNames.OPENAI_MODEL,
          available: false,
        },
      ],
    });

    expect(getFirstAvailableOpenAiModel).toHaveBeenCalled();
  });
});
