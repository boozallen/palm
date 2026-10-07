import React from 'react';
import { act, fireEvent, screen } from '@testing-library/react';
import { notifications } from '@mantine/notifications';

import { renderWrapper } from '@/test/test-utils';
import { DocumentUploadStatus } from '@/features/shared/types/document';
import ConversationalWorkflowPlanner from './ConversationalWorkflowPlanner';

const mockSetNodes = jest.fn();
const mockSetEdges = jest.fn();
const mockPlanConversational = jest.fn();
const mockGetPresignedUrl = jest.fn();
const mockProcessDocument = jest.fn();
const mockOnSaveWorkflow = jest.fn();

let mockPinnedGroup: { id: string; aiProviderIds: string[] } | null = null;

jest.mock('@/libs', () => ({
  trpc: {
    useUtils: jest.fn(() => ({
      shared: {
        getDocuments: {
          invalidate: jest.fn(),
          fetch: jest.fn(),
          refetch: jest.fn(),
        },
      },
    })),
  },
}));

jest.mock('@/components/content/Markdown', () => {
  return jest.fn(({ value }: { value: string }) => <div>{value}</div>);
});

jest.mock('@/features/shared/api/get-system-config', () => ({
  useGetSystemConfig: jest.fn(() => ({
    data: { documentLibraryDocumentUploadProviderId: 'provider-1' },
  })),
}));

jest.mock('@/features/shared/api/get-available-models', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: { availableModels: [] },
  })),
}));

jest.mock('@/features/shared/api/document-upload/get-documents', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    data: {
      documents: [
        {
          id: 'doc-1',
          filename: 'policy.pdf',
          uploadStatus: DocumentUploadStatus.Completed,
          text: 'some text',
        },
      ],
    },
  })),
}));

jest.mock('@/features/shared/api/document-upload/get-presigned-url', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutateAsync: mockGetPresignedUrl,
  })),
}));

jest.mock('@/features/shared/api/document-upload/process-document', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutateAsync: mockProcessDocument,
  })),
}));

jest.mock('@/features/workflows/api/plan-workflow-conversational', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutate: mockPlanConversational,
    isPending: false,
  })),
}));

jest.mock('@/features/workflows/providers/WorkflowBuilderProvider', () => ({
  useWorkflowBuilder: jest.fn(() => ({
    nodes: [],
    edges: [],
    setNodes: mockSetNodes,
    setEdges: mockSetEdges,
    get pinnedGroup() {
      return mockPinnedGroup;
    },
  })),
}));

jest.mock('@/features/workflows/utils/workflow-conversion', () => ({
  workflowToGraph: jest.fn(() => ({ nodes: [], edges: [] })),
  graphToWorkflow: jest.fn(() => []),
}));

const mockGate = jest.fn(async (_modelId, onSubmit) => {
  await onSubmit(undefined);
  return true;
});
jest.mock('@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution', () => ({
  useUserGroupAttribution: jest.fn(() => ({
    gate: mockGate,
    pendingDecision: null,
    idleGroups: [],
    defaultUserGroupId: undefined,
    setDefaultUserGroupId: jest.fn(),
    onSelect: jest.fn(),
    onDismiss: jest.fn(),
  })),
}));

jest.mock('@mantine/notifications', () => ({
  notifications: {
    show: jest.fn(),
    hide: jest.fn(),
  },
}));

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('ConversationalWorkflowPlanner', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPinnedGroup = null;
    mockGate.mockImplementation(async (_modelId, onSubmit) => {
      await onSubmit(undefined);
      return true;
    });
  });

  const sendMessage = async (text: string) => {
    // Typed a character at a time, each re-render costs enough that two messages outrun the default timeout on CI.
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: text } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Send/i }));
    });
  };

  it('renders the heading and input', () => {
    renderWrapper(<ConversationalWorkflowPlanner onSaveWorkflow={mockOnSaveWorkflow} />);

    expect(screen.getByText('Generate Workflow')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Describe the workflow you want to create/i)).toBeInTheDocument();
  });

  it('gates the first message and passes the resolved group to planConversational', async () => {
    mockGate.mockImplementationOnce(async (_modelId, onSubmit) => {
      await onSubmit('group-1');
      return true;
    });

    renderWrapper(<ConversationalWorkflowPlanner onSaveWorkflow={mockOnSaveWorkflow} />);
    await sendMessage('Build me a workflow');

    expect(mockGate).toHaveBeenCalledWith(undefined, expect.any(Function));
    expect(mockPlanConversational).toHaveBeenCalledWith(
      expect.objectContaining({ userMessage: 'Build me a workflow', userGroupId: 'group-1' }),
      expect.any(Object),
    );
  });

  it('does not call planConversational if group attribution is dismissed', async () => {
    mockGate.mockResolvedValueOnce(false);

    renderWrapper(<ConversationalWorkflowPlanner onSaveWorkflow={mockOnSaveWorkflow} />);
    await sendMessage('Build me a workflow');

    expect(mockPlanConversational).not.toHaveBeenCalled();
  });

  it('skips the group attribution gate when the workflow is pinned to a group', async () => {
    mockPinnedGroup = { id: 'pinned-group-1', aiProviderIds: [] };

    renderWrapper(<ConversationalWorkflowPlanner onSaveWorkflow={mockOnSaveWorkflow} />);
    await sendMessage('Build me a workflow');

    expect(mockGate).not.toHaveBeenCalled();
    expect(mockPlanConversational).toHaveBeenCalledWith(
      expect.objectContaining({ userGroupId: 'pinned-group-1' }),
      expect.any(Object),
    );
  });

  it('reuses the resolved group on later turns without gating again', async () => {
    mockGate.mockImplementationOnce(async (_modelId, onSubmit) => {
      await onSubmit('group-1');
      return true;
    });

    renderWrapper(<ConversationalWorkflowPlanner onSaveWorkflow={mockOnSaveWorkflow} />);
    await sendMessage('First message');

    const onSuccess = mockPlanConversational.mock.calls[0][1].onSuccess;
    act(() => {
      onSuccess({ type: 'conversation', message: 'Tell me more', isReadyToGenerate: false });
    });

    await sendMessage('Second message');

    expect(mockGate).toHaveBeenCalledTimes(1);
    expect(mockPlanConversational).toHaveBeenLastCalledWith(
      expect.objectContaining({ userMessage: 'Second message', userGroupId: 'group-1' }),
      expect.any(Object),
    );
  });

  it('updates the workflow builder when the plan is ready to generate', async () => {
    const { workflowToGraph } = require('@/features/workflows/utils/workflow-conversion');
    (workflowToGraph as jest.Mock).mockReturnValue({
      nodes: [{ id: 'new-1' }],
      edges: [{ id: 'edge-1' }],
    });

    renderWrapper(<ConversationalWorkflowPlanner onSaveWorkflow={mockOnSaveWorkflow} />);
    await sendMessage('Build me a workflow');

    const onSuccess = mockPlanConversational.mock.calls[0][1].onSuccess;
    act(() => {
      onSuccess({ type: 'generated', primitives: [{ type: 'test' }], message: 'Done' });
    });

    expect(mockSetNodes).toHaveBeenCalledWith([{ id: 'new-1' }]);
    expect(mockSetEdges).toHaveBeenCalledWith([{ id: 'edge-1' }]);
  });

  it('shows an error notification when planConversational fails', async () => {
    renderWrapper(<ConversationalWorkflowPlanner onSaveWorkflow={mockOnSaveWorkflow} />);
    await sendMessage('Build me a workflow');

    const onError = mockPlanConversational.mock.calls[0][1].onError;
    onError({ message: 'Something went wrong' });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Error', message: 'Something went wrong' }),
    );
  });
});
