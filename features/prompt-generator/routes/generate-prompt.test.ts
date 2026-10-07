import { ContextType } from '@/server/trpc-context';
import { queueGeneratePrompt } from '@/features/prompt-generator/services/queue-generate-prompt-service';
import generatePrompt from '.'; // Assuming this is the router index

jest.mock('@/features/prompt-generator/services/queue-generate-prompt-service');
jest.mock('@/features/shared/dal/getAvailableModels');

describe('generatePrompt', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should queue the prompt and return a jobId', async () => {
    (queueGeneratePrompt as jest.Mock).mockResolvedValue({ jobId: 'job-1' });

    const mockInput = { prompt: 'test prompt' };
    const mockCtx = {
      ai: jest.fn(),
      userId: 'test-user-id',
    } as unknown as ContextType;

    const caller = generatePrompt.createCaller(mockCtx);
    const response = await caller.generatePrompt(mockInput);

    expect(queueGeneratePrompt).toHaveBeenCalledWith('test prompt', 'test-user-id');
    expect(response).toEqual({ jobId: 'job-1' });
  });
});
