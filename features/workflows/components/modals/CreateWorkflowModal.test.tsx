import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import CreateWorkflowModal from './CreateWorkflowModal';
import { useWorkflowBuilder } from '@/features/workflows/providers/WorkflowBuilderProvider';
import { useCreateWorkflow } from '@/features/workflows/hooks/useCreateWorkflow';
import { validateWorkflowGraph, graphToWorkflow } from '@/features/workflows/utils/workflow-conversion';

jest.mock('@/features/workflows/providers/WorkflowBuilderProvider');
jest.mock('@/features/workflows/hooks/useCreateWorkflow');
jest.mock('@/features/workflows/utils/workflow-conversion');

const mockUseWorkflowBuilder = useWorkflowBuilder as jest.Mock;
const mockUseCreateWorkflow = useCreateWorkflow as jest.Mock;

describe('CreateWorkflowModal', () => {
  const mockMutateAsync = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseWorkflowBuilder.mockReturnValue({
      nodes: [{ id: 'node-1' }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      pinnedGroup: null,
    });
    mockUseCreateWorkflow.mockReturnValue({ mutateAsync: mockMutateAsync, isPending: false });
    (validateWorkflowGraph as jest.Mock).mockReturnValue({ valid: true });
    (graphToWorkflow as jest.Mock).mockReturnValue([{ id: 'prim-1' }]);
    mockMutateAsync.mockResolvedValue({ id: 'workflow-1' });
  });

  const fillAndSubmit = async (name = 'My Workflow') => {
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: name } });
    fireEvent.click(screen.getByRole('button', { name: /create workflow/i }));
    await waitFor(() => expect(mockMutateAsync).toHaveBeenCalled());
  };

  it('creates the workflow without a pinnedUserGroupId when the workflow has no pinned group', async () => {
    render(<CreateWorkflowModal opened={true} onClose={jest.fn()} />);

    await fillAndSubmit();

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ pinnedUserGroupId: undefined }),
    );
  });

  it('includes the pinned group id when the workflow is pinned', async () => {
    mockUseWorkflowBuilder.mockReturnValue({
      nodes: [{ id: 'node-1' }],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      pinnedGroup: { id: 'group-1', aiProviderIds: ['provider-1'] },
    });

    render(<CreateWorkflowModal opened={true} onClose={jest.fn()} />);

    await fillAndSubmit();

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ pinnedUserGroupId: 'group-1' }),
    );
  });

  it('calls onSuccess with the created workflow id and name', async () => {
    const onSuccess = jest.fn();
    render(<CreateWorkflowModal opened={true} onClose={jest.fn()} onSuccess={onSuccess} />);

    await fillAndSubmit('My Workflow');

    await waitFor(() => expect(onSuccess).toHaveBeenCalledWith('workflow-1', 'My Workflow'));
  });

  it('does not submit when the workflow graph fails validation', async () => {
    (validateWorkflowGraph as jest.Mock).mockReturnValue({ valid: false, errors: ['Disconnected node'] });

    render(<CreateWorkflowModal opened={true} onClose={jest.fn()} />);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'My Workflow' } });
    fireEvent.click(screen.getByRole('button', { name: /create workflow/i }));

    await waitFor(() => expect(validateWorkflowGraph).toHaveBeenCalled());
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });
});
