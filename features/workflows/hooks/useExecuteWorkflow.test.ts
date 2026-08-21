import { renderHook, act } from '@testing-library/react';
import { useExecuteWorkflow } from './useExecuteWorkflow';
import { useExecuteWorkflow as useExecuteWorkflowMutation } from '@/features/workflows/api/execute-workflow';
import { trpc } from '@/libs';
import { PrimitiveType } from '@/features/workflows/types/primitive';
import { Node } from 'reactflow';
import { PrimitiveNodeData } from '@/features/workflows/components/nodes/PrimitiveNode';

jest.mock('@/features/workflows/api/execute-workflow');
jest.mock('@/libs', () => ({
  trpc: {
    workflows: {
      saveWorkflowPrompt: {
        useMutation: jest.fn(),
      },
    },
  },
}));

// Mirror the real graphToWorkflow logic for test purposes
jest.mock('@/features/workflows/utils/workflow-conversion', () => ({
  graphToWorkflow: jest.fn((nodes: Node<PrimitiveNodeData>[]) =>
    nodes.map((n) => ({
      id: n.id,
      type: n.data.type,
      name: n.data.label,
      config: n.data.config ?? {},
      predecessorIds: [],
    }))
  ),
}));

const mockPromptId = '550e8400-e29b-41d4-a716-446655440010';
const mockWorkflowId = '550e8400-e29b-41d4-a716-446655440000';
const mockExecutionId = '550e8400-e29b-41d4-a716-446655440099';

const makeNode = (
  id: string,
  type: PrimitiveType,
  label: string,
  config: Record<string, unknown> = {},
): Node<PrimitiveNodeData> => ({
  id,
  data: { type, label, icon: () => null, color: '', config },
  position: { x: 0, y: 0 },
});

describe('useExecuteWorkflow', () => {
  const mockSavePromptMutateAsync = jest.fn();
  const mockExecuteMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (trpc.workflows.saveWorkflowPrompt.useMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockSavePromptMutateAsync,
    });

    (useExecuteWorkflowMutation as jest.Mock).mockReturnValue({
      mutateAsync: mockExecuteMutateAsync,
      isPending: false,
    });

    mockSavePromptMutateAsync.mockResolvedValue({ promptId: mockPromptId });
    mockExecuteMutateAsync.mockResolvedValue({ executionId: mockExecutionId, status: 'pending' });
  });

  it('calls saveWorkflowPrompt for an LLM node with a prompt', async () => {
    const { result } = renderHook(() => useExecuteWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        canvasState: {
          nodes: [makeNode('node-llm', PrimitiveType.PROMPT, 'Summarizer', {
            model: 'claude-sonnet-4-6',
            prompt: 'Summarize this.',
          })],
          edges: [],
        },
      });
    });

    expect(mockSavePromptMutateAsync).toHaveBeenCalledWith({
      promptId: undefined,
      instructions: 'Summarize this.',
      model: 'claude-sonnet-4-6',
      temperature: undefined,
    });
  });

  it('replaces prompt text with promptId and strips prompt and promptText from the primitive config', async () => {
    const { result } = renderHook(() => useExecuteWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        canvasState: {
          nodes: [makeNode('node-llm', PrimitiveType.PROMPT, 'Summarizer', {
            model: 'claude-sonnet-4-6',
            prompt: 'Summarize this.',
          })],
          edges: [],
        },
      });
    });

    const executeCall = mockExecuteMutateAsync.mock.calls[0][0];
    const primitive = executeCall.primitives.find((p: { id: string }) => p.id === 'node-llm');
    expect(primitive.config.promptId).toBe(mockPromptId);
    expect(primitive.config.prompt).toBeUndefined();
    expect(primitive.config.promptText).toBeUndefined();
  });

  it('skips saveWorkflowPrompt and strips promptText for a saved workflow', async () => {
    const { result } = renderHook(() => useExecuteWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        canvasState: {
          nodes: [makeNode('node-llm', PrimitiveType.PROMPT, 'Summarizer', {
            model: 'claude-sonnet-4-6',
            promptId: mockPromptId,
            promptText: 'Loaded prompt.',
          })],
          edges: [],
        },
      });
    });

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
    const executeCall = mockExecuteMutateAsync.mock.calls[0][0];
    const primitive = executeCall.primitives.find((p: { id: string }) => p.id === 'node-llm');
    expect(primitive.config.promptText).toBeUndefined();
    expect(primitive.config.promptId).toBe(mockPromptId);
  });

  it('passes non-LLM nodes through without calling saveWorkflowPrompt', async () => {
    const { result } = renderHook(() => useExecuteWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        canvasState: {
          nodes: [makeNode('node-scraper', PrimitiveType.WEBSCRAPER, 'Scraper', {
            url: 'https://example.com',
          })],
          edges: [],
        },
      });
    });

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
    const executeCall = mockExecuteMutateAsync.mock.calls[0][0];
    const primitive = executeCall.primitives.find((p: { id: string }) => p.id === 'node-scraper');
    expect(primitive.config).toEqual({ url: 'https://example.com' });
  });

  it('strips prompt fields without saving when LLM node has no prompt text', async () => {
    const { result } = renderHook(() => useExecuteWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        canvasState: {
          nodes: [makeNode('node-llm', PrimitiveType.PROMPT, 'Summarizer')],
          edges: [],
        },
      });
    });

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
    const executeCall = mockExecuteMutateAsync.mock.calls[0][0];
    const primitive = executeCall.primitives.find((p: { id: string }) => p.id === 'node-llm');
    expect(primitive.config.prompt).toBeUndefined();
  });

  it('skips saveWorkflowPrompt when only model is set with no prompt text', async () => {
    const { result } = renderHook(() => useExecuteWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        canvasState: {
          nodes: [makeNode('node-llm', PrimitiveType.PROMPT, 'Summarizer', {
            model: 'claude-sonnet-4-6',
          })],
          edges: [],
        },
      });
    });

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
  });

  it('calls execute with empty canvas state', async () => {
    const { result } = renderHook(() => useExecuteWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        canvasState: { nodes: [], edges: [] },
      });
    });

    expect(mockSavePromptMutateAsync).not.toHaveBeenCalled();
    expect(mockExecuteMutateAsync).toHaveBeenCalledWith({
      workflowId: mockWorkflowId,
      input: undefined,
      primitives: [],
    });
  });

  it('resolves multiple LLM nodes sequentially', async () => {
    const secondPromptId = '550e8400-e29b-41d4-a716-446655440020';
    mockSavePromptMutateAsync
      .mockResolvedValueOnce({ promptId: mockPromptId })
      .mockResolvedValueOnce({ promptId: secondPromptId });

    const { result } = renderHook(() => useExecuteWorkflow());

    await act(async () => {
      await result.current.mutateAsync({
        workflowId: mockWorkflowId,
        canvasState: {
          nodes: [
            makeNode('node-llm', PrimitiveType.PROMPT, 'Summarizer', {
              model: 'claude-sonnet-4-6',
              prompt: 'Summarize this.',
            }),
            makeNode('node-llm-2', PrimitiveType.PROMPT, 'Classifier', {
              model: 'claude-sonnet-4-6',
              prompt: 'Classify this.',
            }),
          ],
          edges: [],
        },
      });
    });

    expect(mockSavePromptMutateAsync).toHaveBeenCalledTimes(2);
    const executeCall = mockExecuteMutateAsync.mock.calls[0][0];
    const p1 = executeCall.primitives.find((p: { id: string }) => p.id === 'node-llm');
    const p2 = executeCall.primitives.find((p: { id: string }) => p.id === 'node-llm-2');
    expect(p1.config.promptId).toBe(mockPromptId);
    expect(p2.config.promptId).toBe(secondPromptId);
  });

  it('propagates errors from saveWorkflowPrompt', async () => {
    mockSavePromptMutateAsync.mockRejectedValue(new Error('Save prompt failed'));
    const { result } = renderHook(() => useExecuteWorkflow());

    await expect(
      act(async () => {
        await result.current.mutateAsync({
          workflowId: mockWorkflowId,
          canvasState: {
            nodes: [makeNode('node-llm', PrimitiveType.PROMPT, 'Summarizer', {
              model: 'claude-sonnet-4-6',
              prompt: 'Summarize this.',
            })],
            edges: [],
          },
        });
      }),
    ).rejects.toThrow('Save prompt failed');

    expect(mockExecuteMutateAsync).not.toHaveBeenCalled();
  });
});
