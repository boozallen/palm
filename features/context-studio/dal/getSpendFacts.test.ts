import { TimeRange } from '@/features/context-studio/types/context-studio';
import db from '@/server/db';

import getSpendFacts from './getSpendFacts';

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

const OWNER_ID = '22222222-2222-2222-2222-222222222222';
const GROUP_ID = '33333333-3333-3333-3333-333333333333';

type MockFragment = {
  strings: TemplateStringsArray;
  values: unknown[];
};

const isFragment = (value: unknown): value is MockFragment =>
  typeof value === 'object' && value !== null && 'strings' in value;

// Renders a Prisma.sql fragment tree back to text. The scope predicate reaches the
// query as an interpolated fragment, so it lives in `values`, not in the outer
// template's `strings` — a plain join would silently miss it and pass either way.
const render = (value: unknown): string => {
  if (Array.isArray(value)) { return value.map(render).join(''); }
  if (isFragment(value)) {
    return value.strings
      .map((chunk, i) => chunk + (i < value.values.length ? render(value.values[i]) : ''))
      .join('');
  }
  if (typeof value === 'symbol') { return ''; }
  return String(value);
};

describe('getSpendFacts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns an empty list when there was no spend in the period', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    const result = await getSpendFacts(TimeRange.Month, 'all', 'all', true);

    expect(result).toEqual([]);
  });

  it('maps a chat row into a fact carrying the use-case column and its attributed group', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      {
        user_id: OWNER_ID,
        bucket: 'chat',
        use_case: 'proposalCapture',
        user_group_id: GROUP_ID,
        cost: 12.5,
      },
    ]);

    const result = await getSpendFacts(TimeRange.Month, 'all', 'all', true);

    expect(result).toEqual([
      {
        userId: OWNER_ID,
        cost: 12.5,
        bucket: 'chat',
        classification: 'proposalCapture',
        userGroupId: GROUP_ID,
      },
    ]);
  });

  // The value is handed on exactly as the column holds it. Resolution is the pure
  // service's job, so a DAL that quietly repaired a bad value here would put the
  // vocabulary in two places.
  it('passes an unrecognized value straight through without resolving it', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { user_id: OWNER_ID, bucket: 'chat', use_case: 'capture-and-proposal', cost: 1 },
    ]);

    const result = await getSpendFacts(TimeRange.Month, 'all', 'all', true);

    expect(result[0].classification).toBe('capture-and-proposal');
  });

  it('passes the bucket through for every non-chat row', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { user_id: OWNER_ID, bucket: 'platform', use_case: null, cost: 3.5 },
      { user_id: OWNER_ID, bucket: 'workflow', use_case: null, cost: 0.5 },
      { user_id: OWNER_ID, bucket: 'customAgent', use_case: null, cost: 0.25 },
      { user_id: OWNER_ID, bucket: 'unattributed', use_case: null, cost: 0.125 },
      { user_id: OWNER_ID, bucket: 'system', use_case: null, cost: 9 },
    ]);

    const result = await getSpendFacts(TimeRange.Month, 'all', 'all', true);

    expect(result.map((fact) => fact.bucket)).toEqual([
      'platform', 'workflow', 'customAgent', 'unattributed', 'system',
    ]);
  });

  it('coerces a null cost to zero rather than NaN', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([
      { user_id: OWNER_ID, bucket: 'chat', use_case: null, cost: null },
    ]);

    const result = await getSpendFacts(TimeRange.Month, 'all', 'all', true);

    expect(result[0].cost).toBe(0);
  });

  it('throws a sanitized error when the query fails', async () => {
    (db.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('canceling statement due to statement timeout'));

    await expect(
      getSpendFacts(TimeRange.Month, 'all', 'all', true),
    ).rejects.toThrow('Failed to fetch spend facts');
  });

  // The bucket arms are ordered and the order is load-bearing, so the test pins
  // the order rather than only the presence of each arm. The mock cannot execute
  // SQL, so pinning the emitted text is the available check; a reordering here is
  // a silent behaviour change otherwise.
  it('buckets in a fixed precedence: system, platform, workflow, custom agent, unattributed, chat', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getSpendFacts(TimeRange.Month, 'all', 'all', false);

    const sql = render((db.$queryRaw as jest.Mock).mock.calls[0]);
    const arms = [
      sql.indexOf('THEN \'system\''),
      sql.indexOf('THEN \'platform\''),
      sql.indexOf('THEN \'workflow\''),
      sql.indexOf('THEN \'customAgent\''),
      sql.indexOf('THEN \'unattributed\''),
      sql.indexOf('ELSE \'chat\''),
    ];

    expect(arms.every((index) => index >= 0)).toBe(true);
    expect([...arms].sort((first, second) => first - second)).toEqual(arms);
  });

  // The arm that keeps the Unclassified bar meaning something. A chat with no
  // category was never read by the classifier — it predates categorization, or its
  // summary call failed — which is a different fact from the classifier reading a
  // chat and declining to place it. Without this condition the bar opens at the
  // entire pre-feature history and the panel reads as broken on day one.
  it('buckets a chat-linked row as unattributed when its chat has no category', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getSpendFacts(TimeRange.Month, 'all', 'all', false);

    const sql = render((db.$queryRaw as jest.Mock).mock.calls[0]);

    expect(sql).toContain('apu."chatMessageId" IS NULL OR c."useCase" IS NULL');
    expect(sql.indexOf('c."useCase" IS NULL')).toBeLessThan(sql.indexOf('ELSE \'chat\''));
  });

  // Five rows in the live data carry `embedding` AND a chatMessageId: retrieval
  // for a conversation. They belong to the platform, not to the person's work.
  // If the platform arm ever falls below the chat arm, a retrieval cost starts
  // reading as somebody doing research.
  it('tests the platform flags before it tests chat linkage', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getSpendFacts(TimeRange.Month, 'all', 'all', false);

    const sql = render((db.$queryRaw as jest.Mock).mock.calls[0]);

    expect(sql.indexOf('apu."embedding"')).toBeLessThan(sql.indexOf('ELSE \'chat\''));
    expect(sql.indexOf('apu."knowledgeGraph"')).toBeLessThan(sql.indexOf('ELSE \'chat\''));
  });

  // Classification spend is written by buildSystemSource, so it is
  // flagged system. It is now selected rather than filtered out, because the
  // footer reports it — but the first CASE arm is what guarantees it can never
  // reach the bars. Without this, the classifier would inflate the very panel it
  // populates.
  it('selects system spend but buckets it before any other arm can claim it', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getSpendFacts(TimeRange.Month, 'all', 'all', false);

    const sql = render((db.$queryRaw as jest.Mock).mock.calls[0]);

    expect(sql).not.toContain('apu."system" = false');
    expect(sql.indexOf('THEN \'system\'')).toBeLessThan(sql.indexOf('THEN \'platform\''));
  });

  // These joins keyed classification on admin-editable free text and on
  // AgentProvider.name, which is not the same concept as the agents the old term
  // list named. Dropping them is the fix, so their absence is the assertion.
  it('joins only ChatMessage and Chat, and reads the category off the chat', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getSpendFacts(TimeRange.Month, 'all', 'all', false);

    const sql = render((db.$queryRaw as jest.Mock).mock.calls[0]);

    expect(sql).not.toContain('AgentProvider');
    expect(sql).not.toContain('PromptTag');
    expect(sql).not.toContain('WorkflowExecution');
    expect(sql).not.toContain('"Workflow"');
    // The Prompt join existed only to read a declared category off the prompt.
    // That column is gone, so the join has to go with it rather than linger.
    expect(sql).not.toContain('"Prompt"');
    expect(sql).toContain('c."useCase"');
  });

  // The Value tab and the Usage Records tab both report a group's spend out of
  // AiProviderUsage, so they have to agree on what puts a row in a group. Usage
  // Records matches only rows explicitly tagged with the group, excluding
  // untagged legacy rows rather than membership-matching them; this pins the
  // spend query to the same rule.
  it('attributes spend on the usage row\'s own group, excluding untagged legacy rows', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getSpendFacts(TimeRange.Month, GROUP_ID, 'all', false);

    const sql = render((db.$queryRaw as jest.Mock).mock.calls[0]);

    expect(sql).toContain(`apu."userGroupId" = CAST(${GROUP_ID} AS UUID)`);
    expect(sql).not.toContain('apu."userGroupId" IS NULL');
    expect(sql).not.toContain('EXISTS');
    expect(sql).not.toContain('"UserGroupMembership"');
    // The membership-only form attributed every row from any member of the group,
    // tagged or not. That pattern must be replaced, not merely supplemented.
    expect(sql).not.toContain('apu."userId" IN (');
  });

  // The aggregate ('all') path in getUsageRecords.ts excludes untagged rows from
  // the org-wide total; this pins the Value tab to the same rule so it cannot
  // report a different total for the same period.
  it('excludes untagged rows from the org-wide total when no group is selected', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getSpendFacts(TimeRange.Month, 'all', 'all', false);

    const sql = render((db.$queryRaw as jest.Mock).mock.calls[0]);

    expect(sql).toContain('apu."userGroupId" IS NOT NULL');
  });

  it('does not exclude untagged rows when a specific group is selected', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValueOnce([]);

    await getSpendFacts(TimeRange.Month, GROUP_ID, 'all', false);

    const sql = render((db.$queryRaw as jest.Mock).mock.calls[0]);

    expect(sql).not.toContain('apu."userGroupId" IS NOT NULL');
  });
});
