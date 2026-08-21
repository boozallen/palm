import { renderHook, act } from '@testing-library/react';
import { useUpdateWorkflow } from './useUpdateWorkflow';
import { useUpdateWorkflow as useUpdateWorkflowMutation } from '@/features/workflows/api/update-workflow';
import { trpc } from '@/libs';
import { PrimitiveType } from '@/features/workflows/types/primitive';

jest.mock('@/features/workflows/api/update-workflow');
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
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';

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

describe('useUpdateWorkflow', () => {
  const mockSavePromptMutateAsync = jest.fn();
  const mockUpdateMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (trpc.workflows.saveWorkflowPrompt.useMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockSavePromptMutateAsync,
    });

    (useUpdateWorkflowMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateMutateAsync,
      isPending: false,
    });

    mockSavePromptMutateAsync.mockResolvedValue({ promptId: mockPromptId });
    mockUpdateMutateAsync.mockResolvedValue({ id: mockWorkflowId });
  });

  it('calls saveWorkflowPrompt for an LLM primitive with prompt text', async () => {
    const { result } = renderHook(() => useUpdateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
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
    const { result } = renderHook(() => useUpdateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        primitives: [llmPrimitive],
      });
    });

    const updateCall = mockUpdateMutateAsync.mock.calls[0][0];
    const stored = updateCall.primitives[0];
    expect(stored.config.promptId).toBe(mockPromptId);
    expect(stored.config.prompt).toBeUndefined();
  });

  it('passes non-LLM primitives through unchanged without calling saveWorkflowPrompt', async () => {
    const { result } = renderHook(() => useUpdateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        primitives: [scraperPrimitive],
      });
    });

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
    const updateCall = mockUpdateMutateAsync.mock.calls[0][0];
    expect(updateCall.primitives[0]).toEqual(scraperPrimitive);
  });

  it('strips prompt and skips save for an LLM primitive with empty config', async () => {
    const { result } = renderHook(() => useUpdateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        primitives: [
          { id: 'prim-llm', type: PrimitiveType.PROMPT, name: 'Empty', config: {} },
        ],
      });
    });

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
    const updateCall = mockUpdateMutateAsync.mock.calls[0][0];
    expect(updateCall.primitives[0].config.prompt).toBeUndefined();
  });

  it('skips saveWorkflowPrompt and strips promptText for a saved workflow with no local edits', async () => {
    const { result } = renderHook(() => useUpdateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        primitives: [
          {
            id: 'prim-llm',
            type: PrimitiveType.PROMPT,
            name: 'Loaded',
            config: { model: 'claude-sonnet-4-6', promptId: mockPromptId, promptText: 'Existing prompt text.' },
          },
        ],
      });
    });

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
    const updateCall = mockUpdateMutateAsync.mock.calls[0][0];
    expect(updateCall.primitives[0].config.promptText).toBeUndefined();
    expect(updateCall.primitives[0].config.promptId).toBe(mockPromptId);
  });

  it('skips saveWorkflowPrompt when only model is set with no prompt text', async () => {
    const { result } = renderHook(() => useUpdateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
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

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
    const updateCall = mockUpdateMutateAsync.mock.calls[0][0];
    expect(updateCall.primitives[0].config.prompt).toBeUndefined();
  });

  it('saves to prompt table with empty model when only prompt text is set', async () => {
    const { result } = renderHook(() => useUpdateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
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
    const updateCall = mockUpdateMutateAsync.mock.calls[0][0];
    expect(updateCall.primitives[0].config.prompt).toBeUndefined();
    expect(updateCall.primitives[0].config.promptId).toBe(mockPromptId);
  });

  it('calls the update mutation directly when no primitives are provided', async () => {
    const { result } = renderHook(() => useUpdateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        name: 'Renamed Workflow',
      });
    });

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
    expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
      workflowId: mockWorkflowId,
      name: 'Renamed Workflow',
      primitives: undefined,
    });
  });

  it('resolves multiple LLM primitives sequentially', async () => {
    const secondPromptId = '550e8400-e29b-41d4-a716-446655440020';
    mockSavePromptMutateAsync
      .mockResolvedValueOnce({ promptId: mockPromptId })
      .mockResolvedValueOnce({ promptId: secondPromptId });

    const { result } = renderHook(() => useUpdateWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        primitives: [
          llmPrimitive,
          { id: 'prim-llm-2', type: PrimitiveType.PROMPT, name: 'Classifier', config: { model: 'claude-sonnet-4-6', prompt: 'Classify this.' } },
        ],
      });
    });

    expect(mockSavePromptMutateAsync).toHaveBeenCalledTimes(2);
    const updateCall = mockUpdateMutateAsync.mock.calls[0][0];
    expect(updateCall.primitives[0].config.promptId).toBe(mockPromptId);
    expect(updateCall.primitives[1].config.promptId).toBe(secondPromptId);
  });

  it('propagates errors from saveWorkflowPrompt', async () => {
    mockSavePromptMutateAsync.mockRejectedValue(new Error('Save prompt failed'));
    const { result } = renderHook(() => useUpdateWorkflow());

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          workflowId: mockWorkflowId,
          primitives: [llmPrimitive],
        });
      }),
    ).rejects.toThrow('Save prompt failed');

    expect(mockUpdateMutateAsync).not.toHaveBeenCalled();
  });
});
