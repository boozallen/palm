import React from 'react';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { notifications } from '@mantine/notifications';

import { renderWrapper } from '@/test/test-utils';
import { DocumentUploadStatus } from '@/features/shared/types/document';
import WorkflowGenerator from './WorkflowGenerator';

const mockSetNodes = jest.fn();
const mockSetEdges = jest.fn();
const mockGenerate = jest.fn();
const mockGetPresignedUrl = jest.fn();
const mockProcessDocument = jest.fn();

let mockNodes: unknown[] = [];

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

jest.mock('@/features/shared/api/get-system-config', () => ({
  useGetSystemConfig: jest.fn(() => ({
    data: { documentLibraryDocumentUploadProviderId: 'provider-1' },
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
        {
          id: 'doc-2',
          filename: 'report.pdf',
          uploadStatus: DocumentUploadStatus.Completed,
          text: 'other text',
        },
        {
          id: 'doc-3',
          filename: 'pending.pdf',
          uploadStatus: DocumentUploadStatus.Pending,
          text: null,
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

jest.mock('@/features/workflows/api/generate-workflow', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    mutate: mockGenerate,
    isPending: false,
  })),
}));

jest.mock('@/features/workflows/providers/WorkflowBuilderProvider', () => ({
  useWorkflowBuilder: jest.fn(() => ({
    nodes: mockNodes,
    edges: [],
    setNodes: mockSetNodes,
    setEdges: mockSetEdges,
    pinnedGroup: null,
  })),
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

jest.mock('@/features/workflows/utils/workflow-conversion', () => ({
  workflowToGraph: jest.fn(() => ({ nodes: [], edges: [] })),
  graphToWorkflow: jest.fn(() => []),
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

describe('WorkflowGenerator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNodes = [];
  });

  it('renders the heading and form elements', () => {
    renderWrapper(<WorkflowGenerator />);

    expect(screen.getByTestId('generate-workflow-heading')).toBeInTheDocument();
    expect(screen.getByTestId('document-library-select')).toBeInTheDocument();
    expect(screen.getByTestId('upload-from-device-input')).toBeInTheDocument();
    expect(screen.getByTestId('describe-process-textarea')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Generate/i })).toBeInTheDocument();
  });

  it('disables the generate button when description is empty', () => {
    renderWrapper(<WorkflowGenerator />);

    expect(screen.getByRole('button', { name: /Generate/i })).toBeDisabled();
  });

  it('enables the generate button when a description is entered', async () => {
    const user = userEvent.setup();
    renderWrapper(<WorkflowGenerator />);

    const textarea = screen.getByPlaceholderText(/e.g. I want to analyze/i);
    await user.type(textarea, 'Analyze compliance documents');

    expect(screen.getByRole('button', { name: /Generate/i })).toBeEnabled();
  });

  it('calls generate with the process description on button click', async () => {
    const user = userEvent.setup();
    renderWrapper(<WorkflowGenerator />);

    const textarea = screen.getByPlaceholderText(/e.g. I want to analyze/i);
    await user.type(textarea, 'Analyze docs');

    await user.click(screen.getByRole('button', { name: /Generate/i }));

    expect(mockGenerate).toHaveBeenCalledWith(
      {
        description: 'Analyze docs',
        documentIds: [],
        currentWorkflow: undefined,
      },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      }),
    );
  });

  it('shows "Regenerate" button when there is an existing workflow', () => {
    mockNodes = [{ id: '1' }];

    const { useWorkflowBuilder } = require('@/features/workflows/providers/WorkflowBuilderProvider');
    (useWorkflowBuilder as jest.Mock).mockReturnValue({
      nodes: mockNodes,
      edges: [],
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
    });

    renderWrapper(<WorkflowGenerator />);

    expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
  });

  it('passes currentWorkflow when regenerating an existing workflow', async () => {
    mockNodes = [{ id: '1' }];

    const { useWorkflowBuilder } = require('@/features/workflows/providers/WorkflowBuilderProvider');
    (useWorkflowBuilder as jest.Mock).mockReturnValue({
      nodes: mockNodes,
      edges: [],
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
    });

    const user = userEvent.setup();
    renderWrapper(<WorkflowGenerator />);

    const textarea = screen.getByPlaceholderText(/e.g. I want to analyze/i);
    await user.type(textarea, 'Update workflow');

    await user.click(screen.getByRole('button', { name: /Regenerate/i }));

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({
        currentWorkflow: expect.anything(),
      }),
      expect.any(Object),
    );
  });

  it('only shows completed documents with text in the document options', async () => {
    const user = userEvent.setup();
    renderWrapper(<WorkflowGenerator />);

    const multiSelect = screen.getByPlaceholderText('Select documents');
    await user.click(multiSelect);

    expect(await screen.findByText('policy.pdf')).toBeInTheDocument();
    expect(await screen.findByText('report.pdf')).toBeInTheDocument();
    expect(screen.queryByText('pending.pdf')).not.toBeInTheDocument();
  });

  it('shows error notification when generation fails', async () => {
    const user = userEvent.setup();
    renderWrapper(<WorkflowGenerator />);

    const textarea = screen.getByPlaceholderText(/e.g. I want to analyze/i);
    await user.type(textarea, 'Generate something');

    await user.click(screen.getByRole('button', { name: /Generate/i }));

    const onError = mockGenerate.mock.calls[0][1].onError;
    onError({ message: 'Something went wrong' });

    expect(notifications.show).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Failed to Generate Workflow',
        message: 'Something went wrong',
      }),
    );
  });

  it('updates nodes and edges on successful generation', async () => {
    const { workflowToGraph } = require('@/features/workflows/utils/workflow-conversion');
    (workflowToGraph as jest.Mock).mockReturnValue({
      nodes: [{ id: 'new-1' }],
      edges: [{ id: 'edge-1' }],
    });

    const user = userEvent.setup();
    renderWrapper(<WorkflowGenerator />);

    const textarea = screen.getByPlaceholderText(/e.g. I want to analyze/i);
    await user.type(textarea, 'Generate workflow');

    await user.click(screen.getByRole('button', { name: /Generate/i }));

    const onSuccess = mockGenerate.mock.calls[0][1].onSuccess;
    onSuccess({ primitives: [{ type: 'test' }] });

    expect(mockSetNodes).toHaveBeenCalledWith([{ id: 'new-1' }]);
    expect(mockSetEdges).toHaveBeenCalledWith([{ id: 'edge-1' }]);
  });

  it('does not call generate when description is empty', () => {
    renderWrapper(<WorkflowGenerator />);

    const button = screen.getByRole('button', { name: /Generate/i });
    expect(button).toBeDisabled();
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('passes the resolved group attribution choice to generate', async () => {
    mockGate.mockImplementationOnce(async (_modelId, onSubmit) => {
      await onSubmit('group-1');
      return true;
    });

    const user = userEvent.setup();
    renderWrapper(<WorkflowGenerator />);

    const textarea = screen.getByPlaceholderText(/e.g. I want to analyze/i);
    await user.type(textarea, 'Analyze docs');
    await user.click(screen.getByRole('button', { name: /Generate/i }));

    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ userGroupId: 'group-1' }),
      expect.any(Object),
    );
  });

  it('does not call generate if group attribution is dismissed', async () => {
    mockGate.mockResolvedValueOnce(false);

    const user = userEvent.setup();
    renderWrapper(<WorkflowGenerator />);

    const textarea = screen.getByPlaceholderText(/e.g. I want to analyze/i);
    await user.type(textarea, 'Analyze docs');
    await user.click(screen.getByRole('button', { name: /Generate/i }));

    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it('skips the group attribution gate when the workflow is pinned to a group', async () => {
    const { useWorkflowBuilder } = require('@/features/workflows/providers/WorkflowBuilderProvider');
    (useWorkflowBuilder as jest.Mock).mockReturnValue({
      nodes: mockNodes,
      edges: [],
      setNodes: mockSetNodes,
      setEdges: mockSetEdges,
      pinnedGroup: { id: 'pinned-group-1', aiProviderIds: [] },
    });

    const user = userEvent.setup();
    renderWrapper(<WorkflowGenerator />);

    const textarea = screen.getByPlaceholderText(/e.g. I want to analyze/i);
    await user.type(textarea, 'Analyze docs');
    await user.click(screen.getByRole('button', { name: /Generate/i }));

    expect(mockGate).not.toHaveBeenCalled();
    expect(mockGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ userGroupId: 'pinned-group-1' }),
      expect.any(Object),
    );
  });
});
