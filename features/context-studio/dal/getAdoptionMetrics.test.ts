import { TimeRange } from '@/features/context-studio/types/context-studio';
import db from '@/server/db';

import getAdoptionMetrics from './getAdoptionMetrics';

jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
}));
jest.mock('@/server/logger');

jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
      strings,
      values,
    })),
    raw: jest.fn((value: string) => value),
    empty: Symbol('empty'),
  },
}));

const ALICE = '11111111-1111-1111-1111-111111111111';
const BOB = '22222222-2222-2222-2222-222222222222';
const NOMAD = '33333333-3333-3333-3333-333333333333';
const CAPTURE_OPS = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const ACTIVE_ATTRIBUTIONS = [
  { userId: ALICE, userGroupId: CAPTURE_OPS },
  { userId: BOB, userGroupId: CAPTURE_OPS },
  { userId: NOMAD, userGroupId: null },
];

describe('getAdoptionMetrics', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('maps a result row into the adoption shape', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        provisioned: 4012,
        active_attributions: ACTIVE_ATTRIBUTIONS,
        active_previous: 2,
        returning_current: 156,
        returning_previous: 140,
      },
    ]);

    const result = await getAdoptionMetrics(TimeRange.Month, 'all', 'all', true);

    expect(result).toEqual({
      provisionedPeople: 4012,
      activePeople: { value: 3, previous: 2 },
      returningPeople: { value: 156, previous: 140 },
      activeAttributions: ACTIVE_ATTRIBUTIONS,
    });
  });

  it('derives the active count from the distinct people behind the attributions', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        provisioned: 10,
        // Bob appears attributed to two groups; the distinct-people count must
        // not double him.
        active_attributions: [
          { userId: ALICE, userGroupId: CAPTURE_OPS },
          { userId: BOB, userGroupId: CAPTURE_OPS },
          { userId: BOB, userGroupId: null },
        ],
        active_previous: 0,
        returning_current: 0,
        returning_previous: 0,
      },
    ]);

    const result = await getAdoptionMetrics(TimeRange.Month, 'all', 'all', true);

    expect(result.activePeople.value).toBe(2);
  });

  it('returns zeroes when the query returns no rows', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    const result = await getAdoptionMetrics(TimeRange.Month, 'all', 'all', true);

    expect(result).toEqual({
      provisionedPeople: 0,
      activePeople: { value: 0, previous: 0 },
      returningPeople: { value: 0, previous: 0 },
      activeAttributions: [],
    });
  });

  it('coerces null counts and a null attributions array to zero rather than NaN', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        provisioned: 10,
        active_attributions: null,
        active_previous: null,
        returning_current: null,
        returning_previous: null,
      },
    ]);

    const result = await getAdoptionMetrics(TimeRange.Month, 'all', 'all', true);

    expect(result.activePeople).toEqual({ value: 0, previous: 0 });
    expect(result.returningPeople).toEqual({ value: 0, previous: 0 });
    expect(result.activeAttributions).toEqual([]);
  });

  it('throws a sanitized error when the query fails', async () => {
    (db.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('relation "User" does not exist'));

    await expect(
      getAdoptionMetrics(TimeRange.Month, 'all', 'all', true),
    ).rejects.toThrow('Failed to fetch adoption metrics');
  });

  it('bounds the activity CTE at the previous window start', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        provisioned: 0,
        active_attributions: [],
        active_previous: 0,
        returning_current: 0,
        returning_previous: 0,
      },
    ]);

    await getAdoptionMetrics(TimeRange.Month, 'all', 'all', false);

    const callArgs = (db.$queryRaw as jest.Mock).mock.calls[0];
    const fullCallStr = JSON.stringify(callArgs);

    // Without a lower bound, the activity CTE unions all ChatMessage with all
    // WorkflowExecution and materializes it unbounded, paying for the full
    // history. The fix applies buildSinceWindowFilter to both branches, pushing
    // the previous window's start into each scan.
    //
    // Each column must appear TWICE: once in the CTE's SELECT list, and once more
    // in the bound pushed into that branch. Asserting mere presence would pass
    // against the unbounded pre-fix query, where both already appeared in the
    // SELECT list and neither branch was filtered.
    const occurrences = (needle: string): number => fullCallStr.split(needle).length - 1;

    expect(occurrences('cm.\\"createdAt\\"')).toBe(2);
    expect(occurrences('we.\\"startedAt\\"')).toBe(2);
  });

  // Activity means doing real work, and running an agent is real work that never
  // produces a chat. A PRISM or ODRAM job records only its own userId and
  // createdAt, and an agent_threads row is written by the LangGraph service
  // directly — so before this, someone whose entire use of the tool was agent
  // runs counted as provisioned but never as active, and could not become a
  // returning user no matter how many weeks they came back.
  //
  // Agentic chat is deliberately NOT in this list: it goes through the same
  // add-message route as ordinary chat and persists a role='user' ChatMessage
  // before the agentProviderId branch, so the existing ChatMessage arm already
  // covers it. Adding a chats-with-an-agent-provider branch would double-count
  // every one of those turns.
  it('counts agent runs as activity, not just chats and workflows', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        provisioned: 0,
        active_attributions: [],
        active_previous: 0,
        returning_current: 0,
        returning_previous: 0,
      },
    ]);

    await getAdoptionMetrics(TimeRange.Month, 'all', 'all', false);

    const fullCallStr = JSON.stringify((db.$queryRaw as jest.Mock).mock.calls[0]);
    const occurrences = (needle: string): number => fullCallStr.split(needle).length - 1;

    expect(fullCallStr).toContain('AgentPrismJob');
    expect(fullCallStr).toContain('AgentOdramJob');
    expect(fullCallStr).toContain('agent_threads');

    // Twice each, for the same reason as the bound test above: once in the
    // branch's SELECT list and once in the window bound pushed into that branch.
    // Presence alone would pass against a branch added but left unbounded, which
    // would scan the whole history of all three tables on every page load.
    expect(occurrences('pj.\\"createdAt\\"')).toBe(2);
    expect(occurrences('oj.\\"createdAt\\"')).toBe(2);
    expect(occurrences('ath.\\"createdAt\\"')).toBe(2);
  });
});
