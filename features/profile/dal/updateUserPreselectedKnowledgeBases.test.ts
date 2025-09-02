import updateUserPreselectedKnowledgeBases from './updateUserPreselectedKnowledgeBases';
import db from '@/server/db';

jest.mock('@/server/db', () => ({
  user: {
    update: jest.fn(),
  },
}));

describe('updateUserPreselectedKnowledgeBases DAL', () => {

  const userId = '89daf325-4f46-44f1-9f42-a9a557f755ae';
  const knowledgeBaseId = '73bd67d5-3ac9-49be-9fc4-04f5e13b0a7b';

  let preselected: boolean;
  let mockResolve: {
    knowledgeBases: {
      id: string
    }[],
  };
  let mockResponse: { id: string }[];

  const buildUpdatePayload = (userId: string, knowledgeBaseId: string, preselected: boolean) => {
    return {
      where: {
        id: userId,
      },
      data: {
        knowledgeBases: preselected ?
          {
            connect: {
              id: knowledgeBaseId,
            },
          }
          :
          {
            disconnect: {
              id: knowledgeBaseId,
            },
          },
      },
      select: {
        knowledgeBases: {
          select: {
            id: true,
          },
        },
      },
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();

    preselected = true;
    mockResolve = {
      knowledgeBases: [
        { id: '230a46ee-ab0a-4267-8a39-acd7625a4864' },
        { id: '24b9af27-87fb-4093-b35b-105c42956bc2' },
        { id: '73bd67d5-3ac9-49be-9fc4-04f5e13b0a7b' },
      ],
    };
    mockResponse = [
      { id: '230a46ee-ab0a-4267-8a39-acd7625a4864' },
      { id: '24b9af27-87fb-4093-b35b-105c42956bc2' },
      { id: '73bd67d5-3ac9-49be-9fc4-04f5e13b0a7b' },
    ];
  });

  it('connects a User to a KnowledgeBase', async () => {
    (db.user.update as jest.Mock).mockResolvedValue(mockResolve);

    const response = await updateUserPreselectedKnowledgeBases(
      userId,
      knowledgeBaseId,
      preselected,
    );
    expect(response).toEqual(mockResponse);

    expect(db.user.update).toHaveBeenCalledWith(buildUpdatePayload(userId, knowledgeBaseId, preselected));
  });

  it('disconnects a User from a KnowledgeBase', async () => {
    preselected = false;
    mockResolve.knowledgeBases.splice(2, 1);
    mockResponse.splice(2, 1);
    (db.user.update as jest.Mock).mockResolvedValue(mockResolve);

    const response = await updateUserPreselectedKnowledgeBases(
      userId,
      knowledgeBaseId,
      preselected
    );
    expect(response).toEqual(mockResponse);

    expect(db.user.update).toHaveBeenCalledWith(buildUpdatePayload(userId, knowledgeBaseId, preselected));
  });

  it('throws an error if the update fails', async () => {
    const mockError = new Error('db.user.update failed');
    (db.user.update as jest.Mock).mockRejectedValue(mockError);

    await expect(updateUserPreselectedKnowledgeBases(
      userId,
      knowledgeBaseId,
      preselected,
    )).rejects.toThrow('Error updating preselected knowledge bases');
  });

});
