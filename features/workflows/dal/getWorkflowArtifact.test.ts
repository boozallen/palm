import getWorkflowArtifact from '@/features/workflows/dal/getWorkflowArtifact';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: {
    workflowArtifact: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('@/server/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

import db from '@/server/db';

describe('getWorkflowArtifact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return artifact with execution details', async () => {
    const mockArtifact = {
      id: 'artifact-1',
      fileExtension: '.html',
      label: 'Test Report',
      content: '<html>Test content</html>',
      workflowExecutionId: 'execution-1',
      primitiveId: 'primitive-1',
      createdAt: new Date('2024-01-01'),
      workflowExecution: {
        id: 'execution-1',
        triggeredBy: 'user-1',
        workflowId: 'workflow-1',
      },
    };

    (db.workflowArtifact.findUnique as jest.Mock).mockResolvedValue(mockArtifact);

    const result = await getWorkflowArtifact({ artifactId: 'artifact-1' });

    expect(result).toEqual(mockArtifact);
    expect(db.workflowArtifact.findUnique).toHaveBeenCalledWith({
      where: { id: 'artifact-1' },
      include: {
        workflowExecution: {
          select: {
            id: true,
            triggeredBy: true,
            workflowId: true,
          },
        },
      },
    });
  });

  it('should return null if artifact does not exist', async () => {
    (db.workflowArtifact.findUnique as jest.Mock).mockResolvedValue(null);

    const result = await getWorkflowArtifact({ artifactId: 'non-existent' });

    expect(result).toBeNull();
  });

  it('should throw error on database failure', async () => {
    (db.workflowArtifact.findUnique as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    await expect(
      getWorkflowArtifact({ artifactId: 'artifact-1' })
    ).rejects.toThrow('Error fetching workflow artifact');
  });
});
