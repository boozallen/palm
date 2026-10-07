import db from '@/server/db';
import logger from '@/server/logger';
import getAgentProposalJobs, { AGENT_PROPOSAL_JOBS_LIMIT } from '@/features/context-studio/dal/getAgentProposalJobs';
import { buildTimeRangeFilter } from '@/features/context-studio/dal/timeRangeFilter';
import { buildUserScopeFilter } from '@/features/context-studio/dal/userScopeFilter';
import { TimeRange } from '@/features/context-studio/types/context-studio';

jest.mock('@/server/db', () => ({
  $queryRaw: jest.fn(),
}));
jest.mock('@/server/logger');
jest.mock('@/features/context-studio/dal/timeRangeFilter', () => ({
  buildTimeRangeFilter: jest.fn(() => 'TIME_FILTER'),
}));
jest.mock('@/features/context-studio/dal/userScopeFilter', () => ({
  buildUserScopeFilter: jest.fn(() => 'USER_FILTER'),
}));
jest.mock('@prisma/client', () => ({
  Prisma: {
    sql: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
    raw: jest.fn((value: string) => value),
    empty: Symbol('empty'),
  },
}));

const ROW = {
  jobId: 'job-1',
  agentType: 'PRISM',
  agentName: 'PRISM - Navy',
  status: 'completed',
  createdAt: new Date('2026-09-24T14:02:00Z'),
  proposalName: 'NGEN Recompete',
  clientName: 'U.S. Navy',
  opportunitySummary: 'Enterprise network services.',
  financialValue: null,
  fallbackFilename: 'volume-1.docx',
  userName: 'Josh Gordon',
  userEmail: null,
};

describe('getAgentProposalJobs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns rows with ISO timestamps and nullable fields intact', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValue([ROW]);

    const result = await getAgentProposalJobs(TimeRange.Month, 'all', 'all');

    expect(result).toEqual([{ ...ROW, createdAt: '2026-09-24T14:02:00.000Z' }]);
  });

  it('filters both job tables by time range and the group each job ran under', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValue([]);
    const groupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

    await getAgentProposalJobs(TimeRange.Week, groupId, 'all');

    expect(buildTimeRangeFilter).toHaveBeenCalledWith(TimeRange.Week, 'apj."createdAt"');
    expect(buildTimeRangeFilter).toHaveBeenCalledWith(TimeRange.Week, 'aoj."createdAt"');
    expect(buildUserScopeFilter).toHaveBeenCalledWith('apj."userId"', groupId, 'all', 'apj."userGroupId"');
    expect(buildUserScopeFilter).toHaveBeenCalledWith('aoj."userId"', groupId, 'all', 'aoj."userGroupId"');
  });

  it('caps the result at the row limit', async () => {
    (db.$queryRaw as jest.Mock).mockResolvedValue([]);

    await getAgentProposalJobs(TimeRange.Forever, 'all', 'all');

    const values = (db.$queryRaw as jest.Mock).mock.calls[0].slice(1);
    expect(values).toContain(AGENT_PROPOSAL_JOBS_LIMIT);
  });

  it('throws a sanitized error and logs the cause when the query fails', async () => {
    const dbError = new Error('connection lost');
    (db.$queryRaw as jest.Mock).mockRejectedValue(dbError);

    await expect(getAgentProposalJobs(TimeRange.Month, 'all', 'all')).rejects.toThrow('Failed to fetch agent proposal jobs');
    expect(logger.error).toHaveBeenCalledWith('Error fetching agent proposal jobs', { error: dbError });
  });
});
