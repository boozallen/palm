import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import { Node } from 'reactflow';

import SimpleView from '@/features/workflows/components/SimpleView';
import { appTheme } from '@/providers/AppMantineProvider';
import { useWorkflowBuilder } from '@/features/workflows/providers/WorkflowBuilderProvider';
import { useExecuteWorkflow } from '@/features/workflows/hooks/useExecuteWorkflow';
import { useGetWorkflowStatus } from '@/features/workflows/api/get-workflow-status';
import { useCancelWorkflowExecution } from '@/features/workflows/api/cancel-workflow-execution';
import useGetAvailableGitHubProviders from '@/features/shared/api/get-available-github-providers';
import { usePushWorkflowArtifactToGithub } from '@/features/workflows/hooks/usePushWorkflowArtifactToGithub';
import { useSaveWorkflowArtifactVersion } from '@/features/workflows/hooks/useSaveWorkflowArtifactVersion';
import { useGetWorkflowArtifactVersions } from '@/features/workflows/api/get-workflow-artifact-versions';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetDocuments from '@/features/shared/api/document-upload/get-documents';
import { useUserGroupAttribution } from '@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution';
import { PrimitiveType } from '@/features/workflows/types/primitive';
import { PrimitiveNodeData } from '@/features/workflows/components/nodes/PrimitiveNode';
import { AuditRecordEvent, AuditRecordResourceType } from '@/features/shared/types/audit-record';

jest.mock('@/features/shared/hooks/userGroupAttribution/useUserGroupAttribution', () => ({
  useUserGroupAttribution: jest.fn(),
}));

jest.mock('@/features/workflows/providers/WorkflowBuilderProvider', () => ({
  useWorkflowBuilder: jest.fn(),
}));
jest.mock('@/features/workflows/hooks/useExecuteWorkflow', () => ({
  useExecuteWorkflow: jest.fn(),
}));
jest.mock('@/features/workflows/api/get-workflow-status', () => ({
  useGetWorkflowStatus: jest.fn(),
}));
jest.mock('@/features/workflows/api/cancel-workflow-execution', () => ({
  useCancelWorkflowExecution: jest.fn(),
}));
jest.mock('@/features/shared/api/get-available-github-providers', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@/features/workflows/hooks/usePushWorkflowArtifactToGithub', () => ({
  usePushWorkflowArtifactToGithub: jest.fn(),
}));
jest.mock('@/features/workflows/hooks/useSaveWorkflowArtifactVersion', () => ({
  useSaveWorkflowArtifactVersion: jest.fn(),
}));
jest.mock('@/features/workflows/api/get-workflow-artifact-versions', () => ({
  useGetWorkflowArtifactVersions: jest.fn(),
}));
jest.mock('@/features/shared/api/get-system-config', () => ({
  useGetSystemConfig: jest.fn(),
}));
jest.mock('@/features/shared/api/document-upload/get-documents', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('@/features/shared/components/ArtifactEditor', () => ({
  __esModule: true,
  default: ({ onSave }: { onSave: (content: string) => void }) => (
    <button data-testid='mock-artifact-editor-save' onClick={() => onSave('edited content')}>Save</button>
  ),
}));

const mockCreateAuditRecord = jest.fn();
jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: () => ({ mutate: mockCreateAuditRecord }),
}));

const mockGetWorkflowArtifactFetch = jest.fn();
jest.mock('@/libs', () => ({
  trpc: {
    useUtils: jest.fn(() => ({
      workflows: {
        getWorkflow: { invalidate: jest.fn() },
        getWorkflowArtifact: { fetch: mockGetWorkflowArtifactFetch },
      },
    })),
  },
}));

const ARTIFACT_ID = 'artifact-1';

const artifactNode: Node<PrimitiveNodeData> = {
  id: 'node-artifact',
  type: 'primitive',
  position: { x: 0, y: 0 },
  data: {
    type: PrimitiveType.ARTIFACT,
    label: 'Report',
    icon: () => null,
    color: 'green',
    config: {},
  },
};

describe('SimpleView - artifact version history', () => {
  const mockSaveArtifactVersionMutateAsync = jest.fn();
  let mockVersions: { versionNumber: number; content: string; createdAt: Date }[] = [];

  beforeEach(() => {
    jest.clearAllMocks();
    mockVersions = [];

    (useWorkflowBuilder as jest.Mock).mockReturnValue({
      nodes: [artifactNode],
      edges: [],
      getCurrentCanvasState: jest.fn(() => ({ nodes: [artifactNode], edges: [] })),
      setNodes: jest.fn(),
    });
    (useExecuteWorkflow as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useGetWorkflowStatus as jest.Mock).mockReturnValue({
      data: {
        execution: {
          status: 'completed',
          trace: [
            {
              primitiveId: 'node-artifact',
              primitiveType: PrimitiveType.ARTIFACT,
              status: 'completed',
              output: {
                artifactId: ARTIFACT_ID,
                label: 'Report',
                fileExtension: '.md',
              },
            },
          ],
        },
      },
    });
    (useCancelWorkflowExecution as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useGetAvailableGitHubProviders as jest.Mock).mockReturnValue({ data: { availableGitHubProviders: [] } });
    (usePushWorkflowArtifactToGithub as jest.Mock).mockReturnValue({ mutateAsync: jest.fn(), isPending: false });
    (useSaveWorkflowArtifactVersion as jest.Mock).mockReturnValue({
      mutateAsync: mockSaveArtifactVersionMutateAsync,
      isPending: false,
    });
    (useGetWorkflowArtifactVersions as jest.Mock).mockImplementation(() => ({ data: { versions: mockVersions } }));
    (useGetSystemConfig as jest.Mock).mockReturnValue({ data: {} });
    (useGetDocuments as jest.Mock).mockReturnValue({ data: { documents: [] } });
    (useUserGroupAttribution as jest.Mock).mockReturnValue({
      gate: jest.fn(async (_modelId, onSubmit) => {
        await onSubmit(undefined);
        return true;
      }),
      isModalOpen: false,
      groups: [],
      onSelect: jest.fn(),
      onClose: jest.fn(),
    });
    mockGetWorkflowArtifactFetch.mockResolvedValue({ content: 'Latest content' });
  });

  // Renders with the app's Mantine theme so `theme.other.fontWeights` tokens resolve.
  const renderWithTheme = (ui: React.ReactElement) => render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);

  const expectedWorkflowArtifactMetadata = {
    resourceType: AuditRecordResourceType.WorkflowArtifact,
    filenames: ['Report.md'],
    primitiveId: 'node-artifact',
  };

  it('does not render a version selector when the artifact has no saved history', async () => {
    renderWithTheme(<SimpleView workflowId='workflow-1' />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => expect(screen.getByText('Report.md')).toBeInTheDocument());
    expect(screen.queryByTestId('artifact-version-label')).not.toBeInTheDocument();
    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.EditArtifact,
      label: 'workflow artifact "Report.md"',
      metadata: expectedWorkflowArtifactMetadata,
    });
  });

  it('shows the version selector and restores an older version', async () => {
    mockVersions = [
      { versionNumber: 1, content: '# Original', createdAt: new Date('2024-01-01') },
      { versionNumber: 2, content: 'Latest content', createdAt: new Date('2024-01-02') },
    ];
    mockSaveArtifactVersionMutateAsync.mockResolvedValue({
      artifactId: ARTIFACT_ID,
      content: '# Original',
      versionNumber: 3,
    });

    renderWithTheme(<SimpleView workflowId='workflow-1' />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));

    await waitFor(() => expect(screen.getByTestId('artifact-version-label')).toHaveTextContent('Version 2 of 2'));

    fireEvent.click(screen.getByTestId('artifact-version-prev'));
    expect(screen.getByTestId('artifact-version-label')).toHaveTextContent('Version 1 of 2');
    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.NavigateArtifactVersion,
      label: 'workflow artifact "Report.md" to version 1',
      metadata: expectedWorkflowArtifactMetadata,
    });

    fireEvent.click(screen.getByTestId('artifact-version-restore'));

    await waitFor(() => {
      expect(mockSaveArtifactVersionMutateAsync).toHaveBeenCalledWith({
        artifactId: ARTIFACT_ID,
        content: '# Original',
      });
    });
    expect(mockCreateAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.RestoreArtifactVersion,
      label: 'workflow artifact "Report.md" to version 1',
      metadata: expectedWorkflowArtifactMetadata,
    });
  });

  it('records a save audit record when a new version is saved from the editor', async () => {
    mockSaveArtifactVersionMutateAsync.mockResolvedValue({
      artifactId: ARTIFACT_ID,
      content: 'edited content',
      versionNumber: 3,
    });

    renderWithTheme(<SimpleView workflowId='workflow-1' />);

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(screen.getByText('Report.md')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('mock-artifact-editor-save'));

    await waitFor(() => {
      expect(mockCreateAuditRecord).toHaveBeenCalledWith({
        event: AuditRecordEvent.SaveArtifactVersion,
        label: 'workflow artifact "Report.md" (version 3)',
        metadata: expectedWorkflowArtifactMetadata,
      });
    });
  });
});
