import db from '@/server/db';
import createWorkflowPrompt from './createWorkflowPrompt';

jest.mock('@/server/db', () => ({
  prompt: {
    create: jest.fn(),
  },
}));

const mockPromptId = '550e8400-e29b-41d4-a716-446655440010';
const mockCreatorId = '550e8400-e29b-41d4-a716-446655440001';

describe('createWorkflowPrompt', () => {
  const mockCreate = db.prompt.create as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a workflow prompt and return the id', async () => {
    mockCreate.mockResolvedValue({ id: mockPromptId });

    const result = await createWorkflowPrompt({
      title: 'Workflow Prompt',
      instructions: 'Summarize the document.',
      model: 'claude-sonnet-4-6',
      temperature: 0.7,
      creatorId: mockCreatorId,
    });

    expect(mockCreate).toHaveBeenCalledWith({
      data: {
        title: 'Workflow Prompt',
        instructions: 'Summarize the document.',
        model: 'claude-sonnet-4-6',
        temperature: 0.7,
        topP: 0.5,
        summary: '',
        description: '',
        example: '',
        workflows: true,
        creatorId: mockCreatorId,
      },
      select: { id: true },
    });
    expect(result).toEqual({ id: mockPromptId });
  });

  it('should set workflows to true so the prompt is excluded from the library', async () => {
    mockCreate.mockResolvedValue({ id: mockPromptId });

    await createWorkflowPrompt({
      title: 'Workflow Prompt',
      instructions: 'Test prompt',
      model: 'claude-sonnet-4-6',
      temperature: 0.5,
      creatorId: mockCreatorId,
    });

    const calledData = mockCreate.mock.calls[0][0].data;
    expect(calledData.workflows).toBe(true);
  });

  it('should throw on database error', async () => {
    mockCreate.mockRejectedValue(new Error('Database error'));

    await expect(
      createWorkflowPrompt({
        title: 'Workflow Prompt',
        instructions: 'Test prompt',
        model: 'claude-sonnet-4-6',
        temperature: 0.5,
        creatorId: mockCreatorId,
      }),
    ).rejects.toThrow('Error creating workflow prompt');
  });
});
