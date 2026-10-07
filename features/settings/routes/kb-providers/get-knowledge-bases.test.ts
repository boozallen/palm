import { KnowledgeBase } from '@/features/shared/types';
import { UserRole } from '@/features/shared/types/user';
import settingsRouter from '@/features/settings/routes';
import { ContextType } from '@/server/trpc-context';
import getKnowledgeBases from '@/features/shared/dal/getKnowledgeBases';
import { Forbidden } from '@/features/shared/errors/routeErrors';
import getIsUserGroupLead from '@/features/shared/dal/getIsUserGroupLead';

jest.mock('@/features/shared/dal/getKnowledgeBases');
jest.mock('@/features/shared/dal/getIsUserGroupLead');

describe('getKnowledgeBasesRoute', () => {
  const ctx = {
    userRole: UserRole.Admin,
  } as unknown as ContextType;

  const mockKnowledgeBases: KnowledgeBase[] = [
    {
      id: '6b54ffcd-c884-45c9-aa6e-57347f4cc156',
      label: 'Knowledge Base 1',
      externalId: 'test-external-id-1',
      kbProviderId: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
      createdAt: new Date('2021-09-01T00:00:00.000Z'),
      updatedAt: new Date('2021-09-01T00:00:00.000Z'),
    },
    {
      id: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
      label: 'Knowledge Base 2',
      externalId: 'test-external-id-2',
      kbProviderId: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
      createdAt: new Date('2021-09-01T00:00:00.000Z'),
      updatedAt: new Date('2021-09-01T00:00:00.000Z'),
    },
    {
      id: 'a8cccffc-b523-4219-a242-71ecec71dcc6',
      label: 'Knowledge Base 3',
      externalId: 'test-external-id-3',
      kbProviderId: 'a8cccffc-b523-4219-a442-71ecec71dcc6',
      createdAt: new Date('2021-09-01T00:00:00.000Z'),
      updatedAt: new Date('2021-09-01T00:00:00.000Z'),
    },
  ];

  const mockError = Forbidden(
    'You do not have permission to access this resource'
  );

  beforeEach(() => {
    jest.clearAllMocks();

    (getKnowledgeBases as jest.Mock).mockResolvedValue(mockKnowledgeBases);
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(false);
  });

  it('should get all knowledge bases if user is Admin', async () => {
    ctx.userRole = UserRole.Admin;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getKnowledgeBases()).resolves.toEqual({
      knowledgeBases: mockKnowledgeBases.map((record) => ({
        id: record.id,
        label: record.label,
        externalId: record.externalId,
        kbProviderId: record.kbProviderId,
      })),
    });
    expect(getKnowledgeBases).toHaveBeenCalled();
  });

  it('should get user groups if user is not an Admin but is a group lead', async () => {
    ctx.userRole = UserRole.User;
    (getIsUserGroupLead as jest.Mock).mockResolvedValue(true);

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getKnowledgeBases()).resolves.toEqual({
      knowledgeBases: mockKnowledgeBases.map((record) => ({
        id: record.id,
        label: record.label,
        externalId: record.externalId,
        kbProviderId: record.kbProviderId,
      })),
    });
    expect(getKnowledgeBases).toHaveBeenCalled();
    expect(getIsUserGroupLead).toHaveBeenCalledWith(ctx.userId);
  });

  it('should throw error if user is not an Admin and not a group lead', async () => {
    ctx.userRole = UserRole.User;

    const caller = settingsRouter.createCaller(ctx);
    await expect(caller.getKnowledgeBases()).rejects.toThrow(mockError);
    expect(getKnowledgeBases).not.toHaveBeenCalled();
    expect(getIsUserGroupLead).toHaveBeenCalledWith(ctx.userId);
  });
});
