import db from '@/server/db';
import logger from '@/server/logger';
import { PrimitiveType } from '@/features/workflows/types/primitive';
import getWorkflowArtifactCosts from './getWorkflowArtifactCosts';

jest.mock('@/server/db', () => ({
  workflowExecution: {
    findMany: jest.fn(),
  },
  workflowArtifact: {
    findMany: jest.fn(),
  },
  aiProviderUsage: {
    findMany: jest.fn(),
  },
}));
jest.mock('@/server/logger');

describe('getWorkflowArtifactCosts', () => {
  const definition = {
    primitives: [
      { id: 'prompt-1', type: PrimitiveType.PROMPT, name: 'Draft', config: {} },
      {
        id: 'artifact-primitive-1',
        type: PrimitiveType.ARTIFACT,
        name: 'Report',
        config: {},
        predecessorIds: ['prompt-1'],
      },
    ],
  };

  const mockExecution = {
    id: 'exec-1',
    workflow: { definition },
  };

  const mockArtifact = {
    id: 'artifact-1',
    label: 'Report',
    fileExtension: '.html',
    workflowExecutionId: 'exec-1',
    primitiveId: 'artifact-primitive-1',
  };

  const usageRow = (overrides: Record<string, unknown> = {}) => ({
    workflowExecutionId: 'exec-1',
    primitiveId: 'prompt-1',
    inputTokensUsed: 1000,
    costPerInputToken: 0.00001,
    outputTokensUsed: 500,
    costPerOutputToken: 0.00002,
    ...overrides,
  });

  // A query-embedding row for the same prompt primitive, flagged so the usage
  // query returns it alongside the LLM rows. Costs 0.001 over 1000 tokens.
  const embeddingRow = (overrides: Record<string, unknown> = {}) => ({
    workflowExecutionId: 'exec-1',
    primitiveId: 'prompt-1',
    embedding: true,
    inputTokensUsed: 1000,
    costPerInputToken: 0.000001,
    outputTokensUsed: 0,
    costPerOutputToken: 0,
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (db.workflowExecution.findMany as jest.Mock).mockResolvedValue([mockExecution]);
    (db.workflowArtifact.findMany as jest.Mock).mockResolvedValue([mockArtifact]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow()]);
  });

  it('should return an empty map without querying for no execution ids', async () => {
    const result = await getWorkflowArtifactCosts([]);

    expect(result.size).toBe(0);
    expect(db.workflowExecution.findMany).not.toHaveBeenCalled();
  });

  it('should attribute upstream prompt spend to the artifact', async () => {
    const result = await getWorkflowArtifactCosts(['exec-1']);

    // 1000 * 0.00001 + 500 * 0.00002 = 0.02
    expect(result.get('artifact-1')).toEqual({
      artifactId: 'artifact-1',
      label: 'Report',
      fileExtension: '.html',
      workflowExecutionId: 'exec-1',
      cost: 0.02,
      tokens: 1500,
      cumulativeCost: 0.02,
      cumulativeTokens: 1500,
    });
  });

  it('should sum every usage row a prompt primitive produced', async () => {
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow(), usageRow()]);

    const result = await getWorkflowArtifactCosts(['exec-1']);

    expect(result.get('artifact-1')?.cost).toBeCloseTo(0.04);
    expect(result.get('artifact-1')?.tokens).toBe(3000);
  });

  it('should report null cost rather than zero when no usage is attributable', async () => {
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getWorkflowArtifactCosts(['exec-1']);

    expect(result.get('artifact-1')?.cost).toBeNull();
    expect(result.get('artifact-1')?.tokens).toBeNull();
    expect(result.get('artifact-1')?.cumulativeCost).toBeNull();
    expect(result.get('artifact-1')?.cumulativeTokens).toBeNull();
  });

  it('should report null cost when usage rows carry no primitive id', async () => {
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow({ primitiveId: null })]);

    const result = await getWorkflowArtifactCosts(['exec-1']);

    expect(result.get('artifact-1')?.cost).toBeNull();
  });

  it('should report null cost when the workflow definition is missing', async () => {
    (db.workflowExecution.findMany as jest.Mock).mockResolvedValue([
      { id: 'exec-1', workflow: null },
    ]);

    const result = await getWorkflowArtifactCosts(['exec-1']);

    expect(result.get('artifact-1')?.cost).toBeNull();
  });

  it('should split a fan-out prompt across the artifacts it feeds', async () => {
    (db.workflowExecution.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'exec-1',
        workflow: {
          definition: {
            primitives: [
              { id: 'prompt-1', type: PrimitiveType.PROMPT, name: 'Draft', config: {} },
              {
                id: 'artifact-primitive-1',
                type: PrimitiveType.ARTIFACT,
                name: 'One',
                config: {},
                predecessorIds: ['prompt-1'],
              },
              {
                id: 'artifact-primitive-2',
                type: PrimitiveType.ARTIFACT,
                name: 'Two',
                config: {},
                predecessorIds: ['prompt-1'],
              },
            ],
          },
        },
      },
    ]);
    (db.workflowArtifact.findMany as jest.Mock).mockResolvedValue([
      mockArtifact,
      { ...mockArtifact, id: 'artifact-2', primitiveId: 'artifact-primitive-2' },
    ]);

    const result = await getWorkflowArtifactCosts(['exec-1']);

    expect(result.get('artifact-1')?.cost).toBeCloseTo(0.01);
    expect(result.get('artifact-2')?.cost).toBeCloseTo(0.01);
    // Cumulative spend is not split: reaching either artifact required the
    // whole prompt to run.
    expect(result.get('artifact-1')?.cumulativeCost).toBeCloseTo(0.02);
    expect(result.get('artifact-2')?.cumulativeCost).toBeCloseTo(0.02);
  });

  it('should keep spend from one execution out of another', async () => {
    (db.workflowExecution.findMany as jest.Mock).mockResolvedValue([
      mockExecution,
      { id: 'exec-2', workflow: { definition } },
    ]);
    (db.workflowArtifact.findMany as jest.Mock).mockResolvedValue([
      mockArtifact,
      { ...mockArtifact, id: 'artifact-2', workflowExecutionId: 'exec-2' },
    ]);
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow()]);

    const result = await getWorkflowArtifactCosts(['exec-1', 'exec-2']);

    expect(result.get('artifact-1')?.cost).toBeCloseTo(0.02);
    expect(result.get('artifact-2')?.cost).toBeNull();
  });

  it('should throw and log error on failure', async () => {
    const error = new Error('DB error');
    (db.workflowExecution.findMany as jest.Mock).mockRejectedValue(error);

    await expect(getWorkflowArtifactCosts(['exec-1']))
      .rejects.toThrow('Unable to fetch workflow artifact costs');

    expect(logger.error).toHaveBeenCalledWith('Failed to fetch workflow artifact costs', error);
  });

  it('should fold an upstream prompt query-embedding spend into cumulative cost only', async () => {
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([usageRow(), embeddingRow()]);

    const result = await getWorkflowArtifactCosts(['exec-1']);

    // $ Artifact stays the prompt's LLM spend of 0.02; the retrieval that fed it
    // cost another 0.001 and only the cumulative figure counts it.
    expect(result.get('artifact-1')?.cost).toBeCloseTo(0.02, 5);
    expect(result.get('artifact-1')?.tokens).toBe(1500);
    expect(result.get('artifact-1')?.cumulativeCost).toBeCloseTo(0.021, 5);
    expect(result.get('artifact-1')?.cumulativeTokens).toBe(2500);
  });

  it('should report cumulative cost for an artifact whose only upstream spend was a query embedding', async () => {
    (db.aiProviderUsage.findMany as jest.Mock).mockResolvedValue([embeddingRow()]);

    const result = await getWorkflowArtifactCosts(['exec-1']);

    // Retrieval spend is real spend, so cumulative reports it — while $ Artifact
    // stays unknown rather than reading as free, since no LLM call was recorded.
    expect(result.get('artifact-1')?.cost).toBeNull();
    expect(result.get('artifact-1')?.tokens).toBeNull();
    expect(result.get('artifact-1')?.cumulativeCost).toBeCloseTo(0.001, 5);
    expect(result.get('artifact-1')?.cumulativeTokens).toBe(1000);
  });
});
