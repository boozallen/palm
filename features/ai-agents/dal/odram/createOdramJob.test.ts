import db from '@/server/db';
import logger from '@/server/logger';
import createOdramJob from './createOdramJob';

jest.mock('@/server/db', () => ({
  agentOdramJob: {
    create: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('createOdramJob', () => {
  const mockParams = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    aiAgentId: '223e4567-e89b-12d3-a456-426614174001',
    userId: '323e4567-e89b-12d3-a456-426614174002',
    odramFilename: 'odram.pdf',
    userGroupId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (db.agentOdramJob.create as jest.Mock).mockResolvedValue({});
  });

  it('should create a job with correct parameters', async () => {
    await createOdramJob(mockParams);

    expect(db.agentOdramJob.create).toHaveBeenCalledWith({
      data: {
        id: mockParams.id,
        aiAgentId: mockParams.aiAgentId,
        userId: mockParams.userId,
        status: 'queued',
        odramFilename: mockParams.odramFilename,
        userGroupId: mockParams.userGroupId,
      },
    });
  });

  it('should set initial status to queued', async () => {
    await createOdramJob(mockParams);

    expect(db.agentOdramJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'queued' }),
      }),
    );
  });

  it('persists the selected user group on the job', async () => {
    await createOdramJob({ ...mockParams, userGroupId: 'group-1' });

    expect(db.agentOdramJob.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userGroupId: 'group-1' }),
      }),
    );
  });

  it('should throw when db create fails', async () => {
    (db.agentOdramJob.create as jest.Mock).mockRejectedValue(new Error('DB error'));

    await expect(createOdramJob(mockParams)).rejects.toThrow('Error creating ODRAM job');
  });

  it('should log error when db create fails', async () => {
    const mockError = new Error('DB error');
    (db.agentOdramJob.create as jest.Mock).mockRejectedValue(mockError);

    await expect(createOdramJob(mockParams)).rejects.toThrow();

    expect(logger.error).toHaveBeenCalledWith('Error creating ODRAM job: ', mockError);
  });
});
