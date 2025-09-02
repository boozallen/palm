import db from '@/server/db';
import getCertaPolicies from './getCertaPolicies';
import logger from '@/server/logger';

jest.mock('@/server/db', () => {
  return {
    agentCertaPolicy: {
      findMany: jest.fn(),
    },
  };
});

const mockDbPolicies = [
  {
    id: '1',
    aiAgentId: 'agent1',
    title: 'Policy 1',
    content: 'Content 1',
    requirements: 'Requirement 1',
  },
  {
    id: '2',
    aiAgentId: 'agent1',
    title: 'Policy 2',
    content: 'Content 2',
    requirements: 'Requirement 2',
  },
];

describe('getCertaPolicies', () => {
  beforeEach(jest.clearAllMocks);

  it('returns policies for a given agent id', async () => {
    (db.agentCertaPolicy.findMany as jest.Mock).mockResolvedValue(mockDbPolicies);

    await expect(getCertaPolicies('agent1')).resolves.toEqual(mockDbPolicies);

    expect(db.agentCertaPolicy.findMany).toHaveBeenCalledWith({
      where: {
        aiAgentId: 'agent1',
      },
    });
  });

  it('logs an error and throws if the database call fails', async () => {
    const error = new Error('Database error');
    (db.agentCertaPolicy.findMany as jest.Mock).mockRejectedValue(error);

    await expect(getCertaPolicies('agent1')).rejects.toThrow();
    expect(logger.error).toHaveBeenCalledWith(expect.any(String), error);
  });

});
