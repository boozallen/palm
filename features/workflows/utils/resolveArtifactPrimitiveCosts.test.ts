import { PrimitiveConfig, PrimitiveType } from '@/features/workflows/types/primitive';

import resolveArtifactPrimitiveCosts, { PrimitiveUsage } from './resolveArtifactPrimitiveCosts';

const primitive = (
  id: string,
  type: PrimitiveType,
  predecessorIds: string[] = [],
): PrimitiveConfig => ({
  id,
  type,
  name: id,
  config: {},
  predecessorIds,
});

const usage = (primitiveId: string, cost: number, tokens: number): PrimitiveUsage => ({
  primitiveId,
  cost,
  tokens,
});

describe('resolveArtifactPrimitiveCosts', () => {
  it('charges an artifact for its immediate upstream prompt', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['prompt-1']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, [usage('prompt-1', 0.5, 1000)]);

    expect(result.get('artifact-1')).toEqual({
      cost: 0.5,
      tokens: 1000,
      cumulativeCost: 0.5,
      cumulativeTokens: 1000,
      contributingPrimitiveIds: ['prompt-1'],
      cumulativeContributingPrimitiveIds: ['prompt-1'],
    });
  });

  it('ascends past non-prompt primitives to find prompt ancestors', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT),
      primitive('scraper-1', PrimitiveType.WEBSCRAPER, ['prompt-1']),
      primitive('doc-1', PrimitiveType.DOCUMENT, ['scraper-1']),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['doc-1']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, [usage('prompt-1', 0.25, 400)]);

    expect(result.get('artifact-1')).toEqual({
      cost: 0.25,
      tokens: 400,
      cumulativeCost: 0.25,
      cumulativeTokens: 400,
      contributingPrimitiveIds: ['prompt-1'],
      cumulativeContributingPrimitiveIds: ['prompt-1'],
    });
  });

  it('sums every prompt ancestor when a chain has more than one', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT),
      primitive('prompt-2', PrimitiveType.PROMPT, ['prompt-1']),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['prompt-2']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, [
      usage('prompt-1', 0.1, 100),
      usage('prompt-2', 0.2, 200),
    ]);

    const resolved = result.get('artifact-1');
    expect(resolved?.cost).toBeCloseTo(0.3);
    expect(resolved?.tokens).toBe(300);
    expect(resolved?.contributingPrimitiveIds.sort()).toEqual(['prompt-1', 'prompt-2']);
  });

  it('splits a fan-out prompt evenly so artifact costs sum to the real spend', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['prompt-1']),
      primitive('artifact-2', PrimitiveType.ARTIFACT, ['prompt-1']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, [usage('prompt-1', 0.6, 900)]);

    expect(result.get('artifact-1')?.cost).toBeCloseTo(0.3);
    expect(result.get('artifact-2')?.cost).toBeCloseTo(0.3);
    expect(result.get('artifact-1')?.tokens).toBe(450);
    expect(result.get('artifact-2')?.tokens).toBe(450);

    const total = (result.get('artifact-1')?.cost ?? 0) + (result.get('artifact-2')?.cost ?? 0);
    expect(total).toBeCloseTo(0.6);
  });

  it('does not split the fan-out prompt when reporting cumulative spend', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['prompt-1']),
      primitive('artifact-2', PrimitiveType.ARTIFACT, ['prompt-1']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, [usage('prompt-1', 0.6, 900)]);

    // Both artifacts needed the whole prompt to exist, so both report its full
    // spend — cumulative figures overlap by design and do not sum to the total.
    expect(result.get('artifact-1')?.cumulativeCost).toBeCloseTo(0.6);
    expect(result.get('artifact-2')?.cumulativeCost).toBeCloseTo(0.6);
    expect(result.get('artifact-1')?.cumulativeTokens).toBe(900);
    expect(result.get('artifact-2')?.cumulativeTokens).toBe(900);
  });

  it('sums every prompt ancestor into the cumulative spend', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT),
      primitive('prompt-2', PrimitiveType.PROMPT, ['prompt-1']),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['prompt-2']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, [
      usage('prompt-1', 0.1, 100),
      usage('prompt-2', 0.2, 200),
    ]);

    expect(result.get('artifact-1')?.cumulativeCost).toBeCloseTo(0.3);
    expect(result.get('artifact-1')?.cumulativeTokens).toBe(300);
  });

  it('adds an upstream prompt query-embedding spend to cumulative but not to the artifact cost', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['prompt-1']),
    ];

    const result = resolveArtifactPrimitiveCosts(
      primitives,
      [usage('prompt-1', 0.5, 1000)],
      [usage('prompt-1', 0.05, 200)],
    );

    // $ Artifact is a shipped figure and stays the prompt's LLM spend alone;
    // reaching the artifact also required embedding the prompt's retrieval query.
    expect(result.get('artifact-1')?.cost).toBeCloseTo(0.5);
    expect(result.get('artifact-1')?.tokens).toBe(1000);
    expect(result.get('artifact-1')?.cumulativeCost).toBeCloseTo(0.55);
    expect(result.get('artifact-1')?.cumulativeTokens).toBe(1200);
  });

  it('does not split query-embedding spend across a fan-out', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['prompt-1']),
      primitive('artifact-2', PrimitiveType.ARTIFACT, ['prompt-1']),
    ];

    const result = resolveArtifactPrimitiveCosts(
      primitives,
      [usage('prompt-1', 0.6, 900)],
      [usage('prompt-1', 0.1, 100)],
    );

    // The retrieval happened once, but neither artifact could exist without it.
    expect(result.get('artifact-1')?.cumulativeCost).toBeCloseTo(0.7);
    expect(result.get('artifact-2')?.cumulativeCost).toBeCloseTo(0.7);
  });

  it('reports a prompt whose only spend was its query embedding as a cumulative contributor', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['prompt-1']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, [], [usage('prompt-1', 0.05, 200)]);

    // Retrieval spend is real spend, so cumulative must report it rather than
    // read as untracked — while $ Artifact stays unknown, since no LLM ran.
    expect(result.get('artifact-1')?.contributingPrimitiveIds).toEqual([]);
    expect(result.get('artifact-1')?.cumulativeContributingPrimitiveIds).toEqual(['prompt-1']);
    expect(result.get('artifact-1')?.cumulativeCost).toBeCloseTo(0.05);
  });

  it('reports no contributing primitives when the upstream prompt has no usage rows', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['prompt-1']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, []);

    expect(result.get('artifact-1')).toEqual({
      cost: 0,
      tokens: 0,
      cumulativeCost: 0,
      cumulativeTokens: 0,
      contributingPrimitiveIds: [],
      cumulativeContributingPrimitiveIds: [],
    });
  });

  it('reports no contributing primitives for an artifact with no prompt upstream', () => {
    const primitives = [
      primitive('scraper-1', PrimitiveType.WEBSCRAPER),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['scraper-1']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, [usage('scraper-1', 0.5, 100)]);

    expect(result.get('artifact-1')?.contributingPrimitiveIds).toEqual([]);
  });

  it('does not attribute a prompt that is downstream of the artifact', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT),
      primitive('artifact-1', PrimitiveType.ARTIFACT),
      primitive('prompt-2', PrimitiveType.PROMPT, ['artifact-1']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, [
      usage('prompt-1', 0.1, 100),
      usage('prompt-2', 0.2, 200),
    ]);

    expect(result.get('artifact-1')).toEqual({
      cost: 0,
      tokens: 0,
      cumulativeCost: 0,
      cumulativeTokens: 0,
      contributingPrimitiveIds: [],
      cumulativeContributingPrimitiveIds: [],
    });
  });

  it('terminates on a cyclic definition', () => {
    const primitives = [
      primitive('prompt-1', PrimitiveType.PROMPT, ['prompt-2']),
      primitive('prompt-2', PrimitiveType.PROMPT, ['prompt-1']),
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['prompt-1']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, [
      usage('prompt-1', 0.1, 100),
      usage('prompt-2', 0.2, 200),
    ]);

    const resolved = result.get('artifact-1');
    expect(resolved?.cost).toBeCloseTo(0.3);
    expect(resolved?.contributingPrimitiveIds.sort()).toEqual(['prompt-1', 'prompt-2']);
  });

  it('ignores predecessor ids that are not in the definition', () => {
    const primitives = [
      primitive('artifact-1', PrimitiveType.ARTIFACT, ['deleted-node']),
    ];

    const result = resolveArtifactPrimitiveCosts(primitives, [usage('deleted-node', 0.4, 500)]);

    expect(result.get('artifact-1')?.contributingPrimitiveIds).toEqual([]);
  });

  it('returns an empty map when the definition has no artifact primitives', () => {
    const primitives = [primitive('prompt-1', PrimitiveType.PROMPT)];

    expect(resolveArtifactPrimitiveCosts(primitives, [usage('prompt-1', 0.1, 100)]).size).toBe(0);
  });
});
