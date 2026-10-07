import { searchCandidatesExact } from '@/features/graph-database/dal/candidateSearchExact';
import type { Entity, Concept } from '@/features/graph-database/types';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  __esModule: true,
  default: { $queryRaw: jest.fn() },
}));
jest.mock('@/server/logger');

// Jest loads the browser build of Prisma; provide a working Prisma.sql tag.
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
    raw: jest.fn((value: string) => value),
    empty: Symbol('empty'),
  },
}));

const mockQueryRaw = (db as unknown as { $queryRaw: jest.Mock }).$queryRaw;

const sourceEntity: Entity = {
  id: 'src-1',
  name: 'DHA',
  type: 'ORGANIZATION',
  normalizedName: 'dha',
  description: 'Defense Health Agency',
  aliases: ['Defense Health Agency'],
  documentId: 'doc-1',
  mentionCount: 5,
  firstSeenAt: new Date('2024-01-01'),
};

const sourceConcept: Concept = {
  id: 'csrc-1',
  name: 'Machine Learning',
  category: 'TECHNICAL' as Concept['category'],
  description: 'ML',
  documentId: 'doc-1',
  mentionCount: 4,
  firstSeenAt: new Date('2024-01-01'),
};

describe('searchCandidatesExact', () => {
  beforeEach(() => jest.clearAllMocks());

  it('SINGLETON SAFETY: returns [] when the scan yields no rows', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const rows = await searchCandidatesExact(sourceEntity, {
      userId: 'user-1',
      threshold: 0.8,
      isConcept: false,
    });
    expect(rows).toEqual([]);
  });

  it('maps entity rows including type/normalizedName/aliases/similarity', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: 'e2',
        name: 'Defense Health Agency',
        type: 'ORGANIZATION',
        normalizedName: 'defense health agency',
        description: 'Military healthcare',
        aliases: ['DHA'],
        documentId: 'doc-2',
        similarity: 0.93,
      },
    ]);

    const rows = await searchCandidatesExact(sourceEntity, {
      userId: 'user-1',
      threshold: 0.8,
      isConcept: false,
    });

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: 'e2',
      name: 'Defense Health Agency',
      type: 'ORGANIZATION',
      normalizedName: 'defense health agency',
      aliases: ['DHA'],
      similarity: 0.93,
    });
  });

  it('defaults null type/aliases safely on entity rows', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: 'e3',
        name: 'X',
        type: null,
        normalizedName: null,
        description: '',
        aliases: null,
        documentId: 'doc-2',
        similarity: 0.81,
      },
    ]);

    const rows = await searchCandidatesExact(sourceEntity, {
      userId: 'user-1',
      threshold: 0.8,
      isConcept: false,
    });

    expect(rows[0].type).toBeUndefined();
    expect(rows[0].aliases).toEqual([]);
  });

  it('maps concept rows with category and empty aliases', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        id: 'c2',
        name: 'ML',
        category: 'TECHNICAL',
        normalizedName: 'ml',
        description: 'Machine learning',
        documentId: 'doc-2',
        similarity: 0.9,
      },
    ]);

    const rows = await searchCandidatesExact(sourceConcept, {
      userId: 'user-1',
      threshold: 0.8,
      isConcept: true,
    });

    expect(rows[0]).toMatchObject({ id: 'c2', category: 'TECHNICAL', aliases: [] });
    expect(rows[0].type).toBeUndefined();
  });

  it('throws a sanitized error if the query fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('pg exploded with secrets'));
    await expect(
      searchCandidatesExact(sourceEntity, { userId: 'user-1', threshold: 0.8, isConcept: false })
    ).rejects.toThrow('Failed to search resolution candidates');
  });
});
