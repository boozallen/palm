import { PassThrough } from 'stream';
import type { NextApiRequest, NextApiResponse } from 'next';
import { getServerSession } from 'next-auth/next';

import getUsageRecords from '@/features/context-studio/dal/getUsageRecords';
import scopeStudioQuery from '@/features/context-studio/services/scopeStudioQuery';
import { InitiatedBy } from '@/features/context-studio/types/cost';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { UserRole } from '@/features/shared/types/user';
import exportProviderUsageRecords from './index';

// A factory rather than an automock: automocking still loads the real module to
// derive its shape, and next-auth pulls in jose's ESM browser build, which this
// Jest transform cannot parse.
jest.mock('next-auth/next', () => ({ getServerSession: jest.fn() }));
jest.mock('@/features/context-studio/dal/getUsageRecords');
jest.mock('@/features/context-studio/services/scopeStudioQuery');

// The real auth-adapter pulls in jose's ESM browser build, which this Jest
// transform cannot parse. The handler only calls authOptions() and forwards
// its result to getServerSession, which is mocked, so a stub is sufficient.
jest.mock('@/server/auth-adapter', () => ({ authOptions: async () => ({}) }));

describe('exportProviderUsageRecords', () => {
  const mockUserId = '5b0f0f2e-4d21-4a8f-9c3b-0d1f2a3b4c5d';
  const mockUserGroupId = 'b003fe12-5138-4ab5-bb64-a4a1ca8f775a';

  // Frozen so the generated filename is deterministic.
  const NOW = new Date('2026-08-18T12:00:00.000Z');

  const mockResult = {
    initiatedBy: InitiatedBy.Any,
    aiProvider: undefined,
    model: undefined,
    timeRange: TimeRange.Month,
    totalCost: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    providers: [],
  };

  type MockResponse = NextApiResponse & {
    statusCode: number;
    headers: Record<string, string>;
  };

  const buildResponse = (): MockResponse => {
    const res = new PassThrough() as unknown as MockResponse;
    res.headers = {};
    res.status = jest.fn((code: number) => {
      res.statusCode = code;
      return res;
    }) as unknown as MockResponse['status'];
    res.setHeader = jest.fn((name: string, value: string) => {
      res.headers[name] = value;
      return res;
    }) as unknown as MockResponse['setHeader'];
    res.json = jest.fn() as unknown as MockResponse['json'];

    return res;
  };

  const buildRequest = (timeRange: TimeRange, userGroupId = 'all', userId = 'all'): NextApiRequest => ({
    method: 'POST',
    body: {
      initiatedBy: InitiatedBy.Any,
      aiProvider: 'all',
      model: 'all',
      timeRange,
      userGroupId,
      userId,
    },
  } as unknown as NextApiRequest);

  const invoke = async (timeRange: TimeRange, userGroupId = 'all', userId = 'all') => {
    const res = buildResponse();
    await exportProviderUsageRecords(buildRequest(timeRange, userGroupId, userId), res);

    return res;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ now: NOW });

    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: mockUserId, role: UserRole.User },
    });
    (getUsageRecords as jest.Mock).mockResolvedValue(mockResult);
    // Pass-through by default so argument-forwarding assertions below see the
    // scope unchanged; individual tests override this to exercise scoping.
    (scopeStudioQuery as jest.Mock).mockImplementation((_ctx, _userGroupId, userId) =>
      Promise.resolve({ isLead: false, restrictedUserId: userId }));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('exports for a downloader the studio scope check allows', async () => {
    const res = await invoke(TimeRange.Month);

    expect(scopeStudioQuery).toHaveBeenCalledWith(
      { userId: mockUserId, userRole: UserRole.User },
      'all',
      'all',
    );
    expect(res.statusCode).toBe(200);
    expect(getUsageRecords).toHaveBeenCalled();
  });

  it('refuses a request with no signed-in session', async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await invoke(TimeRange.Month);

    expect(res.statusCode).toBe(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'You do not have permission to access this resource' });
    expect(scopeStudioQuery).not.toHaveBeenCalled();
    expect(getUsageRecords).not.toHaveBeenCalled();
  });

  // Covers the missing-grant, group-not-visible, and per-user Lead/Member
  // cases in one place, since scopeStudioQuery already rejects all of them
  // before this handler does anything else.
  it('refuses and does not export when the studio scope check rejects', async () => {
    (scopeStudioQuery as jest.Mock).mockRejectedValue(
      new Error('You do not have permission to access this resource'),
    );

    const res = await invoke(TimeRange.Month, mockUserGroupId);

    expect(res.statusCode).toBe(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'You do not have permission to access this resource' });
    expect(getUsageRecords).not.toHaveBeenCalled();
  });

  it('passes the caller\'s session role into the studio scope check', async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: mockUserId, role: UserRole.Admin },
    });

    await invoke(TimeRange.Month, mockUserGroupId);

    expect(scopeStudioQuery).toHaveBeenCalledWith(
      { userId: mockUserId, userRole: UserRole.Admin },
      mockUserGroupId,
      'all',
    );
  });

  // A CSV of another group's spend is the same disclosure as reading it in the
  // table, so the export must apply the scope's restrictedUserId, not the raw
  // requested userId — otherwise a non-Lead member's 'all' would still export
  // every member's individual spend.
  it('passes the scoped restrictedUserId, not the raw input, to the DAL', async () => {
    (scopeStudioQuery as jest.Mock).mockResolvedValue({ isLead: false, restrictedUserId: mockUserId });

    const res = await invoke(TimeRange.Month, mockUserGroupId, 'all');

    expect(getUsageRecords).toHaveBeenCalledWith(
      InitiatedBy.Any, 'all', 'all', TimeRange.Month, mockUserGroupId, mockUserId,
    );
    expect(res.statusCode).toBe(200);
  });

  // The switch this replaced threw on any preset it did not enumerate, so the two
  // new presets would have failed the download rather than exporting.
  it.each([
    [TimeRange.Day, 'palm-analytics-08/17/2026-08/18/2026.csv'],
    [TimeRange.Week, 'palm-analytics-08/11/2026-08/18/2026.csv'],
    [TimeRange.Month, 'palm-analytics-07/19/2026-08/18/2026.csv'],
    [TimeRange.Year, 'palm-analytics-08/18/2025-08/18/2026.csv'],
    [TimeRange.YearToDate, 'palm-analytics-01/01/2026-08/18/2026.csv'],
  ])('names the %s export after its window', async (timeRange, expected) => {
    const res = await invoke(timeRange);

    expect(res.headers['Content-Disposition']).toBe(`attachment; filename=${expected}`);
  });

  it('labels the unbounded export as all-time', async () => {
    const res = await invoke(TimeRange.Forever);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Disposition']).toBe(
      'attachment; filename=palm-analytics-all-time-08/18/2026.csv',
    );
  });
});
