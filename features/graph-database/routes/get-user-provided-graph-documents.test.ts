import { ContextType } from '@/server/trpc-context';
import graphRouter from '@/features/graph-database/routes';
import getUserProvidedGraphDocuments from '@/features/graph-database/dal/getUserProvidedGraphDocuments';

jest.mock('@/features/graph-database/dal/getUserProvidedGraphDocuments');

const mockDal = getUserProvidedGraphDocuments as jest.MockedFunction<typeof getUserProvidedGraphDocuments>;

describe('getUserProvidedGraphDocuments route', () => {
  const mockUserId = '550e8400-e29b-41d4-a716-446655440000';
  const mockCtx = {
    userId: mockUserId,
    logger: { info: jest.fn(), error: jest.fn() },
  } as unknown as ContextType;

  beforeEach(() => jest.clearAllMocks());

  it('returns the DAL-detected user-provided document ids for the current user', async () => {
    const ids = ['550e8400-e29b-41d4-a716-446655440011'];
    mockDal.mockResolvedValue(ids);

    const caller = graphRouter.createCaller(mockCtx);
    const response = await caller.getUserProvidedGraphDocuments();

    expect(response).toEqual({ userProvidedDocumentIds: ids });
    expect(mockDal).toHaveBeenCalledWith(mockUserId);
  });
});
