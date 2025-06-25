import db from '@/server/db';
import createKnowledgeBase from './createKnowledgeBase';
import logger from '@/server/logger';

jest.mock('@/server/db', () => ({
  knowledgeBase: {
    create: jest.fn(),
  },
}));

const mockResolvedValue = {
  id: 'd8283f19-fc06-40d2-ab82-52f7f02f2025',
  label: 'Test Knowledge Base',
  externalId: 'test-kb',
  kbProviderId: 'd8283f19-fc06-40d2-ab82-52f7f02f2025',
  createdAt: '2021-07-13T12:34:56.000Z',
  updatedAt: '2021-07-13T12:34:56.000Z',
};

describe('createKnowledgeBase', () => {
  it('creates knowledge base successfully', async () => {
    (db.knowledgeBase.create as jest.Mock).mockResolvedValue(mockResolvedValue);

    const response = await createKnowledgeBase({
      label: mockResolvedValue.label,
      externalId: mockResolvedValue.externalId,
      kbProviderId: mockResolvedValue.kbProviderId,
    });

    expect(response).toEqual(mockResolvedValue);
    expect(db.knowledgeBase.create).toHaveBeenCalledWith({
      data: {
        label: mockResolvedValue.label,
        externalId: mockResolvedValue.externalId,
        kbProviderId: mockResolvedValue.kbProviderId,
      },
    });
  });

  it('handles errors successfully', async () => {
    const error = new Error('Test error message');
    (db.knowledgeBase.create as jest.Mock).mockRejectedValue(error);

    await expect(
      createKnowledgeBase({
        label: mockResolvedValue.label,
        externalId: mockResolvedValue.externalId,
        kbProviderId: mockResolvedValue.kbProviderId,
      })
    ).rejects.toThrow('Error creating knowledge base');

    expect(db.knowledgeBase.create).toHaveBeenCalledWith({
      data: {
        label: mockResolvedValue.label,
        externalId: mockResolvedValue.externalId,
        kbProviderId: mockResolvedValue.kbProviderId,
      },
    });
    expect(logger.error).toHaveBeenCalledWith(
      'Error creating knowledge base', error
    );
  });
});
