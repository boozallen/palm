import db from '@/server/db';
import updateWorkflowPrompt from './updateWorkflowPrompt';

jest.mock('@/server/db', () => ({
  prompt: {
    update: jest.fn(),
  },
}));

const mockPromptId = '550e8400-e29b-41d4-a716-446655440010';

describe('updateWorkflowPrompt', () => {
  const mockUpdate = db.prompt.update as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update the instructions for a workflow prompt', async () => {
    mockUpdate.mockResolvedValue({});

    await updateWorkflowPrompt(mockPromptId, 'New instructions here.');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: mockPromptId },
      data: { instructions: 'New instructions here.' },
    });
  });

  it('should update to empty string instructions', async () => {
    mockUpdate.mockResolvedValue({});

    await updateWorkflowPrompt(mockPromptId, '');

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: mockPromptId },
      data: { instructions: '' },
    });
  });

  it('should throw on database error', async () => {
    mockUpdate.mockRejectedValue(new Error('Database error'));

    await expect(
      updateWorkflowPrompt(mockPromptId, 'Some instructions'),
    ).rejects.toThrow('Error updating workflow prompt');
  });
});
