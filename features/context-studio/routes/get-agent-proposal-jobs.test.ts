import { ContextType } from '@/server/trpc-context';
import contextStudioRouter from '@/features/context-studio/routes';
import getAgentProposalJobs from '@/features/context-studio/dal/getAgentProposalJobs';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { AgentProposalJob, TimeRange } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/context-studio/dal/getAgentProposalJobs');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

describe('get-agent-proposal-jobs route', () => {
  const mockUserId = 'ec4dd2cf-c867-4a81-b940-d22d98544a0c';
  const mockUserGroupId = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

  const mockCtx = {
    userId: mockUserId,
    userRole: UserRole.Admin,
  } as unknown as ContextType;

  const mockNonAdminCtx = {
    userId: mockUserId,
    userRole: UserRole.User,
  } as unknown as ContextType;

  const mockJobs: AgentProposalJob[] = [{
    jobId: 'job-1',
    agentType: 'ODRAM',
    agentName: 'ODRAM',
    status: 'completed',
    createdAt: '2026-09-22T09:15:00.000Z',
    proposalName: 'Enterprise Cloud Migration BPA',
    clientName: 'DHS CISA',
    opportunitySummary: 'Five-year BPA to migrate CISA mission systems.',
    financialValue: '$45M ceiling (5-year BPA)',
    fallbackFilename: 'odram-responses.xlsx',
    userName: 'Josh Gordon',
    userEmail: 'jgordon@example.com',
  }];

  const input = {
    timeRange: TimeRange.Month,
    userGroupId: mockUserGroupId,
    userId: 'all',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: 'all' });
  });

  it('returns proposal jobs for an admin', async () => {
    (getAgentProposalJobs as jest.Mock).mockResolvedValue(mockJobs);

    const caller = contextStudioRouter.createCaller(mockCtx);
    const response = await caller.getAgentProposalJobs(input);

    expect(response).toEqual(mockJobs);
    expect(getAgentProposalJobs).toHaveBeenCalledWith(TimeRange.Month, mockUserGroupId, 'all');
  });

  it('passes the scoped user through to the query', async () => {
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: true, restrictedUserId: mockUserId });
    (getAgentProposalJobs as jest.Mock).mockResolvedValue([]);

    const caller = contextStudioRouter.createCaller(mockCtx);
    await caller.getAgentProposalJobs(input);

    expect(getAgentProposalJobs).toHaveBeenCalledWith(TimeRange.Month, mockUserGroupId, mockUserId);
  });

  it('rejects non-admins before querying', async () => {
    const caller = contextStudioRouter.createCaller(mockNonAdminCtx);

    await expect(caller.getAgentProposalJobs(input)).rejects.toThrow('You do not have permission to access this resource');
    expect(scopeStudioQuery).not.toHaveBeenCalled();
    expect(getAgentProposalJobs).not.toHaveBeenCalled();
  });
});
