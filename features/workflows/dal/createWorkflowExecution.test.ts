import createWorkflowExecution from './createWorkflowExecution';
import db from '@/server/db';
import logger from '@/server/logger';
import { WorkflowStatus } from '@/features/workflows/types/workflow';

jest.mock('@/server/db', () => ({
  workflowExecution: {
    create: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('createWorkflowExecution DAL', () => {
  const executionId = 'exec-1';
  const workflowId = 'workflow-1';
  const userId = 'user-1';
  const input = { foo: 'bar' };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('creates a workflow execution with no user group by default', async () => {
    (db.workflowExecution.create as jest.Mock).mockResolvedValue({ id: executionId });

    await createWorkflowExecution(executionId, workflowId, userId, input);

    expect(db.workflowExecution.create).toHaveBeenCalledWith({
      data: {
        id: executionId,
        workflowId,
        status: WorkflowStatus.PENDING,
        triggeredBy: userId,
        input,
        trace: [],
        userGroupId: null,
      },
    });
  });

  it('persists the selected user group', async () => {
    (db.workflowExecution.create as jest.Mock).mockResolvedValue({ id: executionId });

    await createWorkflowExecution(executionId, workflowId, userId, input, 'group-1');

    expect(db.workflowExecution.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userGroupId: 'group-1' }),
    }));
  });

  it('logs and throws an error if the operation fails', async () => {
    const rejectError = new Error('DB error');
    (db.workflowExecution.create as jest.Mock).mockRejectedValue(rejectError);

    await expect(createWorkflowExecution(executionId, workflowId, userId, input)).rejects.toThrow(
      'Failed to save execution: DB error',
    );

    expect(logger.error).toHaveBeenCalledWith('Error creating workflow execution:', rejectError);
  });
});
