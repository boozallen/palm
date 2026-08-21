import db from '@/server/db';
import deleteWorkflow from './deleteWorkflow';
import deleteWorkflowPrompts from '@/features/workflows/dal/deleteWorkflowPrompts';
import { PrimitiveType } from '@/features/workflows/types/primitive';

jest.mock('@/server/db', () => ({
  workflow: {
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
}));

jest.mock('@/features/workflows/dal/deleteWorkflowPrompts');

jest.mock('@/features/shared/errors/prismaErrors', () => ({
  handlePrismaError: jest.fn((err) => (err instanceof Error ? err.message : String(err))),
}));

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockPromptId = '550e8400-e29b-41d4-a716-446655440010';

const mockWorkflowWithPrompt = {
  id: mockWorkflowId,
  createdBy: mockUserId,
  definition: {
    primitives: [
      {
        id: 'p1',
        type: PrimitiveType.PROMPT,
        name: 'Summarizer',
        config: { model: 'claude-sonnet-4-6', promptId: mockPromptId },
      },
    ],
  },
};

describe('deleteWorkflow', () => {
  const mockFindUnique = db.workflow.findUnique as jest.Mock;
  const mockDelete = db.workflow.delete as jest.Mock;
  const mockDeletePrompts = deleteWorkflowPrompts as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeletePrompts.mockResolvedValue(undefined);
    mockDelete.mockResolvedValue({ id: mockWorkflowId });
  });

  it('should delete the workflow and its associated LLM prompts', async () => {
    mockFindUnique.mockResolvedValue(mockWorkflowWithPrompt);

    const result = await deleteWorkflow(mockWorkflowId, mockUserId);

    expect(mockDeletePrompts).toHaveBeenCalledWith([mockPromptId]);
    expect(mockDelete).toHaveBeenCalledWith({ where: { id: mockWorkflowId } });
    expect(result).toEqual({ id: mockWorkflowId });
  });

  it('should call deleteWorkflowPrompts with an empty array when no LLM primitives exist', async () => {
    mockFindUnique.mockResolvedValue({
      ...mockWorkflowWithPrompt,
      definition: {
        primitives: [
          {
            id: 'p1',
            type: PrimitiveType.WEBSCRAPER,
            name: 'Scraper',
            config: { url: 'https://example.com' },
          },
        ],
      },
    });

    await deleteWorkflow(mockWorkflowId, mockUserId);

    expect(mockDeletePrompts).toHaveBeenCalledWith([]);
    expect(mockDelete).toHaveBeenCalled();
  });

  it('should throw if workflow is not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(deleteWorkflow(mockWorkflowId, mockUserId)).rejects.toThrow();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should throw if user does not own the workflow', async () => {
    mockFindUnique.mockResolvedValue({
      ...mockWorkflowWithPrompt,
      createdBy: 'different-user-id',
    });

    await expect(deleteWorkflow(mockWorkflowId, mockUserId)).rejects.toThrow();
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it('should throw on database error', async () => {
    mockFindUnique.mockResolvedValue(mockWorkflowWithPrompt);
    mockDelete.mockRejectedValue(new Error('DB error'));

    await expect(deleteWorkflow(mockWorkflowId, mockUserId)).rejects.toThrow();
  });
});
