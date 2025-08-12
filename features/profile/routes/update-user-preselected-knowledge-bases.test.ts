import updateUserPreselectedKnowledgeBases from '@/features/profile/dal/updateUserPreselectedKnowledgeBases';
import profileRouter from '@/features/profile/routes';
import { ContextType } from '@/server/trpc-context';
import { Unauthorized } from '@/features/shared/errors/routeErrors';

jest.mock('@/features/profile/dal/updateUserPreselectedKnowledgeBases');

describe('update-user-preselected-knowledge-bases route', () => {
  const mockUserId = '6de3d2d5-1918-4288-993a-7445a2c8dbf9';
  const mockResolve = [
    { id: '230a46ee-ab0a-4267-8a39-acd7625a4864' },
    { id: '24b9af27-87fb-4093-b35b-105c42956bc2' },
    { id: '73bd67d5-3ac9-49be-9fc4-04f5e13b0a7b' },
  ];
  const mockError = Unauthorized(
    'You do not have permission to access this resource'
  );

  let mockInput: {
    knowledgeBaseId: string;
    preselected: boolean;
  };
  let ctx: ContextType;

  beforeEach(() => {
    jest.clearAllMocks();

    mockInput = {
      knowledgeBaseId: '73bd67d5-3ac9-49be-9fc4-04f5e13b0a7b',
      preselected: true,
    };
    ctx = {
      userId: mockUserId,
    } as unknown as ContextType;
  });

  it('updates the user\'s preselected KnowledgeBases', async () => {
    (updateUserPreselectedKnowledgeBases as jest.Mock).mockResolvedValueOnce(
      mockResolve
    );

    const caller = profileRouter.createCaller(ctx);
    await expect(
      caller.updateUserPreselectedKnowledgeBases(mockInput)
    ).resolves.toEqual({ knowledgeBases: mockResolve });

    expect(updateUserPreselectedKnowledgeBases).toHaveBeenCalledTimes(1);
    expect(updateUserPreselectedKnowledgeBases).toHaveBeenCalledWith(
      mockUserId,
      mockInput.knowledgeBaseId,
      mockInput.preselected
    );
  });

  it('rejects invalid input', async () => {
    mockInput.knowledgeBaseId = 'invalid-UUID';

    const caller = profileRouter.createCaller(ctx);
    await expect(
      caller.updateUserPreselectedKnowledgeBases(mockInput)
    ).rejects.toThrow();

    expect(updateUserPreselectedKnowledgeBases).not.toHaveBeenCalled();
  });

  it('throws an error if there is no user', async () => {
    ctx = {
      user: null,
    } as unknown as ContextType;

    const caller = profileRouter.createCaller(ctx);
    await expect(
      caller.updateUserPreselectedKnowledgeBases(mockInput)
    ).rejects.toThrow(mockError);

    expect(updateUserPreselectedKnowledgeBases).not.toHaveBeenCalled();
  });
});
