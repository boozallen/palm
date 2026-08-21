import updateKnowledgeBase from './updateKnowledgeBase';
import db from '@/server/db';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  knowledgeBase: {
    update: jest.fn(),
  },
}));

const mockInput = {
  id: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
  label: 'New Label',
  externalId: 'New External Id',
};

const mockUpdatedKnowledgeBase = {
  id: mockInput.id,
  label: mockInput.label,
  externalId: mockInput.externalId,
  kbProviderId: 'ec4dd2cf-c867-4a81-b940-d22d98544a0c',
  createdAt: new Date('2024-04-04T00:00:00.000Z'),
  updatedAt: new Date('2024-04-04T00:00:00.000Z'),
};

describe('updateKnowledgeBase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should update the knowledge base record in the database', async () => {
    (db.knowledgeBase.update as jest.Mock).mockResolvedValue(
      mockUpdatedKnowledgeBase
    );

    await updateKnowledgeBase(mockInput);

    expect(db.knowledgeBase.update).toHaveBeenCalledWith({
      where: {
        id: mockInput.id,
      },
      data: {
        label: mockInput.label,
        externalId: mockInput.externalId,
      },
    });
  });

  it('should return updated knowledge base record when update is successful', async () => {
    (db.knowledgeBase.update as jest.Mock).mockResolvedValue(
      mockUpdatedKnowledgeBase
    );

    const result = await updateKnowledgeBase(mockInput);

    expect(result).toEqual(mockUpdatedKnowledgeBase);
  });

  it('should throw an error and log it if update fails', async () => {
    (db.knowledgeBase.update as jest.Mock).mockRejectedValue(
      new Error('Database error')
    );

    await expect(updateKnowledgeBase(mockInput)).rejects.toThrow(
      'Error updating knowledge base'
    );

    expect(logger.error).toHaveBeenCalledWith(
      'Error updating knowledge base',
      new Error('Database error')
    );
  });
});
