import db from '@/server/db';
import createPrompt from '@/features/shared/dal/createPrompt';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  prompt: {
    create: jest.fn(),
  },
}));

describe('createPrompt', () => {
  const mockCreatePromptResolvedValue = {
    id: 'd7164c5f-ccd4-4a13-aa0c-4df7548f991a',
    creatorId: 'a1ef51cd-49d7-440b-868f-d674791d3c32',
    title: 'Mock Prompt',
    summary: 'Mock Summary',
    description: 'Mock Description',
    instructions: 'Mock Instructions',
    example: 'Mock Example',
    tags: [{ tag: 'tag1' }, { tag: 'tag2' }],
    config: {
      randomness: 0.5,
      model: 'gpt-4',
      repetitiveness: 0.5,
      bestOf: 0.5,
      presencePenalty: 0.5,
      frequencyPenalty: 0.5,
    },
  };

  const mockInput = {
    prompt: {
      id: 'd7164c5f-ccd4-4a13-aa0c-4df7548f991a',
      creatorId: 'a1ef51cd-49d7-440b-868f-d674791d3c32',
      title: 'Mock Prompt',
      summary: 'Mock Summary',
      description: 'Mock Description',
      instructions: 'Mock Instructions',
      example: 'Mock Example',
      tags: ['tag1', 'tag2'],
      config: {
        randomness: 0.5,
        model: 'gpt-4',
        repetitiveness: 0.5,
      },
    },
  };

  const mockReturnValue = {
    config: {},
    creatorId: 'a1ef51cd-49d7-440b-868f-d674791d3c32',
    description: 'Mock Description',
    example: 'Mock Example',
    id: 'd7164c5f-ccd4-4a13-aa0c-4df7548f991a',
    instructions: 'Mock Instructions',
    summary: 'Mock Summary',
    tags: ['tag1', 'tag2'],
    title: 'Mock Prompt',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create prompt successfully', async () => {
    (db.prompt.create as jest.Mock).mockResolvedValue(
      mockCreatePromptResolvedValue
    );

    const mockCreatePrompt = await createPrompt(mockInput);

    const { tags, config, ...otherValues } = mockInput.prompt;
    expect(db.prompt.create).toHaveBeenCalledWith({
      data: {
        tags: { create: tags.map((tag) => ({ tag })) },
        ...config,
        ...otherValues,
      },
      include: {
        tags: true,
      },
    });

    expect(mockCreatePrompt).toEqual(mockReturnValue);
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should throw an error if create prompt fails', async () => {
    (db.prompt.create as jest.Mock).mockRejectedValueOnce(
      new Error('DB error')
    );

    await expect(createPrompt(mockInput)).rejects.toThrow(
      'Error creating prompt'
    );
    expect(logger.error).toHaveBeenCalled();
  });

  it('should throw an error if create prompt is null', async () => {
    (db.prompt.create as jest.Mock).mockResolvedValueOnce(null);

    await expect(createPrompt(mockInput)).rejects.toThrow(
      'Error creating prompt'
    );

    const { tags, config, ...otherValues } = mockInput.prompt;

    expect(db.prompt.create).toHaveBeenCalledWith({
      data: {
        tags: { create: tags.map((tag) => ({ tag })) },
        ...config,
        ...otherValues,
      },
      include: {
        tags: true,
      },
    });
    expect(logger.error).toHaveBeenCalled();
  });
});
