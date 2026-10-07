import { UserRole } from '@/features/shared/types/user';
import { ContextType } from '@/server/trpc-context';
import settingsRouter from '@/features/settings/routes';
import { getGraphDatabaseSource } from '@/features/graph-database';

jest.mock('@/features/graph-database');

describe('getUserKnowledgeGraph route', () => {
  let ctx: ContextType;

  const mockSession = {
    run: jest.fn(),
    close: jest.fn(),
  };

  const mockGraphDb = {
    getSession: jest.fn().mockResolvedValue(mockSession),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    ctx = {
      userRole: UserRole.Admin,
      logger: { debug: jest.fn(), error: jest.fn() },
    } as unknown as ContextType;

    (getGraphDatabaseSource as jest.Mock).mockResolvedValue(mockGraphDb);
    mockSession.run.mockResolvedValue({ records: [] });
  });

  it('excludes :IdentityCluster/:IN_CLUSTER from the network query — this admin view is not documentId-scoped', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await caller.graphDatabase.getUserKnowledgeGraph({ limit: 200, labels: [], relationships: [] });

    const query = mockSession.run.mock.calls[0][0] as string;
    expect(query).toContain('NOT n:IdentityCluster');
    expect(query).toContain('NOT m:IdentityCluster');
    expect(query).toContain('type(r) <> \'IN_CLUSTER\'');
  });

  it('keeps isolated nodes: the relationship exclusion is null-safe for the OPTIONAL MATCH miss', async () => {
    const caller = settingsRouter.createCaller(ctx);

    await caller.graphDatabase.getUserKnowledgeGraph({ limit: 200, labels: [], relationships: [] });

    const query = mockSession.run.mock.calls[0][0] as string;
    expect(query).toContain('m IS NULL OR NOT m:IdentityCluster');
    expect(query).toContain('r IS NULL OR type(r) <> \'IN_CLUSTER\'');
  });

  it('throws Forbidden for a non-admin user', async () => {
    const nonAdminCtx = { ...ctx, userRole: UserRole.User } as unknown as ContextType;
    const caller = settingsRouter.createCaller(nonAdminCtx);

    await expect(
      caller.graphDatabase.getUserKnowledgeGraph({ limit: 200, labels: [], relationships: [] })
    ).rejects.toThrow('You do not have permission to access this resource');
  });
});
