import db from '@/server/db';
import getWorkflow from './getWorkflow';
import { PrimitiveType } from '@/features/workflows/types/primitive';

jest.mock('@/server/db', () => ({
  workflow: {
    findUnique: jest.fn(),
  },
  prompt: {
    findUnique: jest.fn(),
  },
}));

const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockPromptId = '550e8400-e29b-41d4-a716-446655440010';

const mockWorkflowBase = {
  id: mockWorkflowId,
  name: 'Test Workflow',
  createdBy: mockUserId,
  deletedAt: null,
  creator: { id: mockUserId, name: 'Alice', email: 'alice@example.com' },
  userGroups: [],
  executions: [],
};

describe('getWorkflow', () => {
  const mockFindUnique = db.workflow.findUnique as jest.Mock;
  const mockPromptFindUnique = db.prompt.findUnique as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return null when the workflow is not found', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getWorkflow(mockWorkflowId, mockUserId);

    expect(result).toBeNull();
    expect(mockPromptFindUnique).not.toHaveBeenCalled();
  });

  it('should return the workflow as-is when it has no LLM primitives', async () => {
    const workflow = {
      ...mockWorkflowBase,
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
    };
    mockFindUnique.mockResolvedValue(workflow);

    const result = await getWorkflow(mockWorkflowId, mockUserId);

    expect(result).toEqual(workflow);
    expect(mockPromptFindUnique).not.toHaveBeenCalled();
  });

  it('should inject prompt text into LLM primitives that have a promptId', async () => {
    const workflow = {
      ...mockWorkflowBase,
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
    mockFindUnique.mockResolvedValue(workflow);
    mockPromptFindUnique.mockResolvedValue({ instructions: 'Summarize this document.' });

    const result = await getWorkflow(mockWorkflowId, mockUserId);

    expect(mockPromptFindUnique).toHaveBeenCalledWith({
      where: { id: mockPromptId },
      select: { instructions: true },
    });
    const def = result!.definition as { primitives: Array<{ config: { promptText?: string } }> };
    expect(def.primitives[0].config.promptText).toBe('Summarize this document.');
  });

  it('should skip prompt resolution for LLM primitives without a promptId', async () => {
    const workflow = {
      ...mockWorkflowBase,
      definition: {
        primitives: [
          {
            id: 'p1',
            type: PrimitiveType.PROMPT,
            name: 'LLM',
            config: { model: 'claude-sonnet-4-6' },
          },
        ],
      },
    };
    mockFindUnique.mockResolvedValue(workflow);

    const result = await getWorkflow(mockWorkflowId, mockUserId);

    expect(mockPromptFindUnique).not.toHaveBeenCalled();
    expect(result).toEqual(workflow);
  });

  it('should throw on database error', async () => {
    mockFindUnique.mockRejectedValue(new Error('DB error'));

    await expect(getWorkflow(mockWorkflowId, mockUserId)).rejects.toThrow(
      'Error fetching workflow',
    );
  });
});
