import { renderHook, act } from '@testing-library/react';
import { useCreateWorkflow } from './useCreateWorkflow';
import { useCreateWorkflow as useCreateWorkflowMutation } from '@/features/workflows/api/create-workflow';
import { trpc } from '@/libs';
import { PrimitiveType } from '@/features/workflows/types/primitive';

jest.mock('@/features/workflows/api/create-workflow');
jest.mock('@/libs', () => ({
  trpc: {
    workflows: {
      saveWorkflowPrompt: {
        useMutation: jest.fn(),
      },
    },
  },
}));

const mockPromptId = '550e8400-e29b-41d4-a716-446655440010';

const llmPrimitive = {
  id: 'prim-llm',
  type: PrimitiveType.PROMPT,
  name: 'Summarizer',
  config: { model: 'claude-sonnet-4-6', prompt: 'Summarize this.' },
};

const scraperPrimitive = {
  id: 'prim-scraper',
  type: PrimitiveType.WEBSCRAPER,
  name: 'Scraper',
  config: { url: 'https://example.com' },
};

describe('useCreateWorkflow', () => {
  const mockSavePromptMutateAsync = jest.fn();
  const mockCreateMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (trpc.workflows.saveWorkflowPrompt.useMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockSavePromptMutateAsync,
    });

    (useCreateWorkflowMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockCreateMutateAsync,
      isPending: false,
    });

    mockSavePromptMutateAsync.mockResolvedValue({ promptId: mockPromptId });
    mockCreateMutateAsync.mockResolvedValue({ id: 'new-workflow-id' });
  });

  it('calls saveWorkflowPrompt for an LLM primitive with prompt text', async () => {
    const { result } = renderHook(() => useCreateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        name: 'My Workflow',
        primitives: [llmPrimitive],
      });
    });

    expect(mockSavePromptMutateAsync).toHaveBeenCalledWith({
      promptId: undefined,
      instructions: 'Summarize this.',
      model: 'claude-sonnet-4-6',
      temperature: undefined,
    });
  });

  it('replaces prompt text with promptId and strips the prompt field', async () => {
    const { result } = renderHook(() => useCreateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        name: 'My Workflow',
        primitives: [llmPrimitive],
      });
    });

    const createCall = mockCreateMutateAsync.mock.calls[0][0];
    const stored = createCall.primitives[0];
    expect(stored.config.promptId).toBe(mockPromptId);
    expect(stored.config.prompt).toBeUndefined();
  });

  it('passes non-LLM primitives through unchanged without calling saveWorkflowPrompt', async () => {
    const { result } = renderHook(() => useCreateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        name: 'My Workflow',
        primitives: [scraperPrimitive],
      });
    });

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
    const createCall = mockCreateMutateAsync.mock.calls[0][0];
    expect(createCall.primitives[0]).toEqual(scraperPrimitive);
  });

  it('does not save prompt and removes inline prompt text when LLM config is empty', async () => {
    const { result } = renderHook(() => useCreateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        name: 'My Workflow',
        primitives: [
          { id: 'prim-llm', type: PrimitiveType.PROMPT, name: 'Empty', config: {} },
        ],
      });
    });

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
    const createCall = mockCreateMutateAsync.mock.calls[0][0];
    expect(createCall.primitives[0].config.prompt).toBeUndefined();
  });

  it('saves to prompt table with empty model when only prompt text is set', async () => {
    const { result } = renderHook(() => useCreateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        name: 'My Workflow',
        primitives: [
          {
            id: 'prim-llm',
            type: PrimitiveType.PROMPT,
            name: 'No Model',
            config: { prompt: 'Summarize this.' },
          },
        ],
      });
    });

    expect(mockSavePromptMutateAsync).toHaveBeenCalledWith({
      promptId: undefined,
      instructions: 'Summarize this.',
      model: '',
      temperature: undefined,
    });
    const createCall = mockCreateMutateAsync.mock.calls[0][0];
    expect(createCall.primitives[0].config.prompt).toBeUndefined();
    expect(createCall.primitives[0].config.promptId).toBe(mockPromptId);
  });

  it('saves to prompt table with empty instructions when only model is set', async () => {
    const { result } = renderHook(() => useCreateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        name: 'My Workflow',
        primitives: [
          {
            id: 'prim-llm',
            type: PrimitiveType.PROMPT,
            name: 'No Prompt',
            config: { model: 'claude-sonnet-4-6' },
          },
        ],
      });
    });

    expect(mockSavePromptMutateAsync).toHaveBeenCalledWith({
      promptId: undefined,
      instructions: '',
      model: 'claude-sonnet-4-6',
      temperature: undefined,
    });
    const createCall = mockCreateMutateAsync.mock.calls[0][0];
    expect(createCall.primitives[0].config.prompt).toBeUndefined();
    expect(createCall.primitives[0].config.promptId).toBe(mockPromptId);
  });

  it('resolves multiple LLM primitives sequentially', async () => {
    const secondPromptId = '550e8400-e29b-41d4-a716-446655440020';
    mockSavePromptMutateAsync
      .mockResolvedValueOnce({ promptId: mockPromptId })
      .mockResolvedValueOnce({ promptId: secondPromptId });

    const { result } = renderHook(() => useCreateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        name: 'My Workflow',
        primitives: [
          llmPrimitive,
          { id: 'prim-llm-2', type: PrimitiveType.PROMPT, name: 'Classifier', config: { model: 'claude-sonnet-4-6', prompt: 'Classify this.' } },
        ],
      });
    });

    expect(mockSavePromptMutateAsync).toHaveBeenCalledTimes(2);
    const createCall = mockCreateMutateAsync.mock.calls[0][0];
    expect(createCall.primitives[0].config.promptId).toBe(mockPromptId);
    expect(createCall.primitives[1].config.promptId).toBe(secondPromptId);
  });

  it('propagates errors from saveWorkflowPrompt', async () => {
    mockSavePromptMutateAsync.mockRejectedValue(new Error('Save prompt failed'));
    const { result } = renderHook(() => useCreateWorkflow());

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          name: 'My Workflow',
          primitives: [llmPrimitive],
        });
      }),
    ).rejects.toThrow('Save prompt failed');

    expect(mockCreateMutateAsync).not.toHaveBeenCalled();
  });
});
