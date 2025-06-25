import db from '@/server/db';
import updatePrompt from './updatePrompt';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  $transaction: jest.fn(),
}));

const mockInput = {
  id: '9c35620a-c180-45ed-af43-b7d2687fa019',
  title: 'Mock Title',
  summary: 'Mock Summary',
  description: 'Mock Description',
  instructions: 'Mock Instructions',
  example: 'Mock Example',
  model: 'Mock Model',
  randomness: 0.5,
  repetitiveness: 0.5,
  tags: ['Mock Tag New', 'Mock Tag Same'],
};

const mockCurrentPromptTags = [
  {
    promptId: '9c35620a-c180-45ed-af43-b7d2687fa019',
    tag: 'Mock Tag Old', // should be in list of tags to delete
  },
  {
    promptId: '9c35620a-c180-45ed-af43-b7d2687fa019',
    tag: 'Mock Tag Same',
  },
];

const mockUpdatedPrompt = {
  id: '9c35620a-c180-45ed-af43-b7d2687fa019',
  creatorId: '8b1aea23-92ee-4324-9240-004eb3e2b6c0',
  title: 'Mock Title',
  summary: 'Mock Summary',
  description: 'Mock Description',
  instructions: 'Mock Instructions',
  example: 'Mock Example',
  model: 'Mock Model',
  randomness: 0.5,
  repetitiveness: 0.5,
  tags: [
    {
      promptId: '9c35620a-c180-45ed-af43-b7d2687fa019',
      tag: 'Mock Tag Same',
    },
    {
      promptId: '9c35620a-c180-45ed-af43-b7d2687fa019',
      tag: 'Mock Tag New', // should be in list of tags to create
    },
  ],
};

describe('updatePrompt', () => {
  const mockFindMany = jest.fn();
  const mockUpdate = jest.fn();

  let tagsToDelete: { promptId: string, tag: string }[];
  let tagsToCreate: string[];

  beforeEach(() => {
    jest.clearAllMocks();

    (db.$transaction as jest.Mock).mockImplementation(async (callback) => {
      return callback({
        prompt: {
          update: mockUpdate,
        },
        promptTag: {
          findMany: mockFindMany,
        },
      });
    });

    tagsToDelete = mockCurrentPromptTags.filter(tag => !mockInput.tags.includes(tag.tag));
    tagsToCreate = mockInput.tags.filter(tag => !mockCurrentPromptTags.map(t => t.tag).includes(tag));
  });

  it('should update a prompt', async () => {
    mockFindMany.mockResolvedValue(mockCurrentPromptTags);
    mockUpdate.mockResolvedValue(mockUpdatedPrompt);

    await expect(updatePrompt(mockInput)).resolves.toEqual({
      id: mockUpdatedPrompt.id,
      creatorId: mockUpdatedPrompt.creatorId,
      title: mockUpdatedPrompt.title,
      summary: mockUpdatedPrompt.summary,
      description: mockUpdatedPrompt.description,
      instructions: mockUpdatedPrompt.instructions,
      example: mockUpdatedPrompt.example,
      tags: mockUpdatedPrompt.tags.map(tag => tag.tag),
      config: {
        model: mockUpdatedPrompt.model,
        randomness: mockUpdatedPrompt.randomness,
        repetitiveness: mockUpdatedPrompt.repetitiveness,
      },
    });

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        promptId: mockInput.id,
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        id: mockInput.id,
      },
      data: {
        title: mockInput.title,
        summary: mockInput.summary,
        description: mockInput.description,
        instructions: mockInput.instructions,
        example: mockInput.example,
        model: mockInput.model,
        randomness: mockInput.randomness,
        repetitiveness: mockInput.repetitiveness,
        tags: {
          deleteMany: tagsToDelete.map(tag => ({ tag: tag.tag })),
          createMany: {
            data: tagsToCreate.map(tag => ({ tag })),
          },
        },
      },
      include: {
        tags: true,
      },
    });
  });

  it('should not call update method if error retrieving prompt tags', async () => {
    const mockError = new Error('Something went wrong');

    mockFindMany.mockRejectedValue(mockError);

    await expect(updatePrompt(mockInput)).rejects.toThrow('Error updating prompt');

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        promptId: mockInput.id,
      },
    });

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalled();
  });

  it('should throw an error if problem updating prompt', async () => {
    const mockError = new Error('Record not found');

    mockFindMany.mockResolvedValue(mockCurrentPromptTags);
    mockUpdate.mockRejectedValue(mockError);

    await expect(updatePrompt(mockInput)).rejects.toThrow('Error updating prompt');
    expect(logger.error).toHaveBeenCalled();

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        promptId: mockInput.id,
      },
    });

    expect(mockUpdate).toHaveBeenCalledWith({
      where: {
        id: mockInput.id,
      },
      data: {
        title: mockInput.title,
        summary: mockInput.summary,
        description: mockInput.description,
        instructions: mockInput.instructions,
        example: mockInput.example,
        model: mockInput.model,
        randomness: mockInput.randomness,
        repetitiveness: mockInput.repetitiveness,
        tags: {
          deleteMany: tagsToDelete.map(tag => ({ tag: tag.tag })),
          createMany: {
            data: tagsToCreate.map(tag => ({ tag })),
          },
        },
      },
      include: {
        tags: true,
      },
    });
    expect(logger.error).toHaveBeenCalled();
  });
});
