import db from '@/server/db';
import getKnowledgeBases from './getKnowledgeBases';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  knowledgeBase: {
    findMany: jest.fn(),
  },
}));

describe('getAllKnowledgeBases', () => {
  const mockReturnedValue = [
    {
      id: 1,
      label: 'Label 1',
      externalId: 'External ID 1',
      kbProviderId: 'e91850df-58b8-426b-b9f8-910d97d957bd',
      createdAt: '2021-09-01T00:00:00.000Z',
      updatedAt: '2021-09-01T00:00:00.000Z',
    },
    {
      id: 2,
      label: 'Label 2',
      externalId: 'External ID 2',
      kbProviderId: 'b69a2c60-013f-40b4-a557-43331c005fde',
      createdAt: '2021-09-01T00:00:00.000Z',
      updatedAt: '2021-09-01T00:00:00.000Z',
    },
    {
      id: 3,
      label: 'Label 3',
      externalId: 'External ID 3',
      kbProviderId: '12513728-53b3-4ac7-beaa-bfa89048f4c5',
      createdAt: '2021-09-01T00:00:00.000Z',
      updatedAt: '2021-09-01T00:00:00.000Z',
    },
  ];

  const mockError = new Error('Error fetching knowledge bases');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns all records found in the DB', async () => {
    (db.knowledgeBase.findMany as jest.Mock).mockResolvedValue(mockReturnedValue);

    await expect(getKnowledgeBases()).resolves.toEqual(mockReturnedValue);
    expect(db.knowledgeBase.findMany).toHaveBeenCalledWith({
      where: { deletedAt: null },
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('throws an error when the DB query fails', async () => {
    (db.knowledgeBase.findMany as jest.Mock).mockRejectedValue(mockError);

    await expect(getKnowledgeBases()).rejects.toThrow(mockError);
    expect(logger.error).toHaveBeenCalledWith(
      'Error fetching knowledge bases', mockError
    );
  });
});
