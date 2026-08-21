import createWorkflowArtifact from '@/features/workflows/dal/createWorkflowArtifact';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    workflowArtifact: {
      create: jest.fn(),
    },
  },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

jest.mock('crypto', () => ({
  randomUUID: jest.fn(() => 'mock-uuid'),
}));

import db from '@/server/db';

describe('createWorkflowArtifact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create and return a workflow artifact', async () => {
    const mockArtifact = {
      id: 'mock-uuid',
      fileExtension: '.html',
      label: 'Test Report',
      content: '<html>Test content</html>',
      workflowExecutionId: 'execution-1',
      primitiveId: 'primitive-1',
      createdAt: new Date('2024-01-01'),
    };

    (db.workflowArtifact.create as jest.Mock).mockResolvedValue(mockArtifact);

    const result = await createWorkflowArtifact({
      fileExtension: '.html',
      label: 'Test Report',
      content: '<html>Test content</html>',
      workflowExecutionId: 'execution-1',
      primitiveId: 'primitive-1',
    });

    expect(result).toEqual(mockArtifact);
    expect(db.workflowArtifact.create).toHaveBeenCalledWith({
      data: {
        id: 'mock-uuid',
        fileExtension: '.html',
        label: 'Test Report',
        content: '<html>Test content</html>',
        workflowExecutionId: 'execution-1',
        primitiveId: 'primitive-1',
      },
    });
  });

  it('should create artifact with different file extensions', async () => {
    const mockArtifact = {
      id: 'mock-uuid',
      fileExtension: '.json',
      label: 'Data Export',
      content: '{"data": "test"}',
      workflowExecutionId: 'execution-2',
      primitiveId: 'primitive-2',
      createdAt: new Date('2024-01-02'),
    };

    (db.workflowArtifact.create as jest.Mock).mockResolvedValue(mockArtifact);

    const result = await createWorkflowArtifact({
      fileExtension: '.json',
      label: 'Data Export',
      content: '{"data": "test"}',
      workflowExecutionId: 'execution-2',
      primitiveId: 'primitive-2',
    });

    expect(result).toEqual(mockArtifact);
  });

  it('should throw error on database failure', async () => {
    (db.workflowArtifact.create as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    await expect(
      createWorkflowArtifact({
        fileExtension: '.html',
        label: 'Test Report',
        content: '<html>Test content</html>',
        workflowExecutionId: 'execution-1',
        primitiveId: 'primitive-1',
      })
    ).rejects.toThrow('Error creating workflow artifact');
  });
});
