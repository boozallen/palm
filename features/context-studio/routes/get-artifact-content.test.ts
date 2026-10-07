import { UserRole } from '@/features/shared/types/user';

const mockGetArtifactContent = jest.fn();
jest.mock('@/features/context-studio/dal/getArtifactContent', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetArtifactContent(...args),
}));

const mockGetArtifactOwner = jest.fn();
jest.mock('@/features/context-studio/dal/getArtifactOwner', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetArtifactOwner(...args),
}));

const mockGetStudioUserGroups = jest.fn();
jest.mock('@/features/context-studio/dal/getStudioUserGroups', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetStudioUserGroups(...args),
}));

const mockGetUserGroupMembership = jest.fn();
jest.mock('@/features/settings/dal/user-groups/getUserGroupMembership', () => ({
  __esModule: true,
  default: (...args: unknown[]) => mockGetUserGroupMembership(...args),
}));

jest.mock('@/server/trpc', () => ({
  procedure: {
    input: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    query: jest.fn().mockImplementation((handler) => handler),
  },
}));

jest.mock('@/features/shared/errors/routeErrors', () => ({
  Forbidden: jest.fn((msg: string) => new Error(msg)),
}));

describe('get-artifact-content route', () => {
  let routeHandler: (opts: { input: Record<string, unknown>; ctx: { userId: string; userRole: string } }) => Promise<unknown>;

  beforeAll(async () => {
    const { procedure } = await import('@/server/trpc');
    await import('./get-artifact-content');
    routeHandler = (procedure.input as jest.Mock).mock.results[0]?.value?.query?.mock?.calls?.[0]?.[0]
      ?? (procedure as unknown as { query: jest.Mock }).query.mock.calls[0][0];
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lets an Admin download any artifact without an ownership check', async () => {
    const mockResult = { label: 'Report', fileExtension: '.md', content: '# Report', binaryContent: null };
    mockGetArtifactContent.mockResolvedValue(mockResult);

    const result = await routeHandler({
      input: { source: 'chat', id: 'artifact-1' },
      ctx: { userId: 'admin-1', userRole: UserRole.Admin },
    });

    expect(mockGetArtifactOwner).not.toHaveBeenCalled();
    expect(mockGetArtifactContent).toHaveBeenCalledWith('chat', 'artifact-1');
    expect(result).toEqual(mockResult);
  });

  it('lets a non-Admin download their own artifact', async () => {
    mockGetArtifactOwner.mockResolvedValue('member-1');
    const mockResult = { label: 'Report', fileExtension: '.md', content: '# Report', binaryContent: null };
    mockGetArtifactContent.mockResolvedValue(mockResult);

    const result = await routeHandler({
      input: { source: 'chat', id: 'artifact-1' },
      ctx: { userId: 'member-1', userRole: UserRole.User },
    });

    expect(mockGetUserGroupMembership).not.toHaveBeenCalled();
    expect(mockGetArtifactContent).toHaveBeenCalledWith('chat', 'artifact-1');
    expect(result).toEqual(mockResult);
  });

  it('lets a Lead download an artifact belonging to a member of a group they lead', async () => {
    mockGetArtifactOwner.mockResolvedValue('member-2');
    mockGetStudioUserGroups.mockResolvedValue([
      { id: 'group-1', label: 'Capture Team', isLead: true },
      { id: 'group-2', label: 'Delivery Team', isLead: false },
    ]);
    mockGetUserGroupMembership.mockResolvedValue({ userGroupId: 'group-1', userId: 'member-2', role: 'User' });
    const mockResult = { label: 'Report', fileExtension: '.md', content: '# Report', binaryContent: null };
    mockGetArtifactContent.mockResolvedValue(mockResult);

    const result = await routeHandler({
      input: { source: 'chat', id: 'artifact-1' },
      ctx: { userId: 'lead-1', userRole: UserRole.User },
    });

    expect(mockGetStudioUserGroups).toHaveBeenCalledWith('lead-1', false);
    expect(mockGetUserGroupMembership).toHaveBeenCalledWith('member-2', 'group-1');
    expect(mockGetArtifactContent).toHaveBeenCalledWith('chat', 'artifact-1');
    expect(result).toEqual(mockResult);
  });

  it('rejects a plain member downloading another member\'s artifact', async () => {
    mockGetArtifactOwner.mockResolvedValue('member-2');
    mockGetStudioUserGroups.mockResolvedValue([
      { id: 'group-1', label: 'Capture Team', isLead: false },
    ]);

    await expect(
      routeHandler({ input: { source: 'chat', id: 'artifact-1' }, ctx: { userId: 'member-1', userRole: UserRole.User } }),
    ).rejects.toThrow('You do not have permission to access this resource');

    expect(mockGetUserGroupMembership).not.toHaveBeenCalled();
    expect(mockGetArtifactContent).not.toHaveBeenCalled();
  });

  it('rejects a Lead downloading an artifact belonging to a user outside every group they lead', async () => {
    mockGetArtifactOwner.mockResolvedValue('outsider-1');
    mockGetStudioUserGroups.mockResolvedValue([
      { id: 'group-1', label: 'Capture Team', isLead: true },
    ]);
    mockGetUserGroupMembership.mockResolvedValue(null);

    await expect(
      routeHandler({ input: { source: 'chat', id: 'artifact-1' }, ctx: { userId: 'lead-1', userRole: UserRole.User } }),
    ).rejects.toThrow('You do not have permission to access this resource');

    expect(mockGetArtifactContent).not.toHaveBeenCalled();
  });
});
