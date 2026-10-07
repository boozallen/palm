import db from '@/server/db';
import getAvailablePolicies from '@/features/ai-agents/dal/certa/getAvailablePolicies';
import { Prisma } from '@prisma/client';

jest.mock('@/server/db', () => ({
  aiAgent: {
    findFirst: jest.fn(),
  },
  agentCertaPolicy: {
    findMany: jest.fn(),
  },
}));

jest.mock('@/server/logger', () => ({
  error: jest.fn(),
}));

describe('getAvailablePolicies DAL', () => {
  const mockUserId = 'bf0659a1-1efb-449f-9cc3-d1c585b9a002';
  const mockAgentId = 'f6033fbf-809c-45bd-a67e-28c1cd344bdd';

  const mockPolicies = [
    {
      id: 'e4909f12-7b9e-4fdc-b881-be60266ba21b',
      title: 'Policy 1',
      content: 'Content for policy 1',
      requirements: 'Requirements for policy 1',
      aiAgentId: mockAgentId,
    },
    {
      id: '5864f378-aaec-4c71-9efe-ce3fd9381c90',
      title: 'Policy 2',
      content: 'Content for policy 2',
      requirements: 'Requirements for policy 2',
      aiAgentId: mockAgentId,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    (db.aiAgent.findFirst as jest.Mock).mockResolvedValue({ id: mockAgentId });

    (db.agentCertaPolicy.findMany as jest.Mock).mockResolvedValue(mockPolicies);
  });

  it('should fetch policies with default parameters', async () => {
    const result = await getAvailablePolicies(mockUserId, mockAgentId);

    expect(db.aiAgent.findFirst).toHaveBeenCalledWith({
      where: {
        id: mockAgentId,
        userGroups: {
          some: {
            userGroupMemberships: {
              some: {
                userId: mockUserId,
              },
            },
          },
        },
      },
    });

    expect(db.agentCertaPolicy.findMany).toHaveBeenCalledWith({
      where: {
        aiAgentId: mockAgentId,
      },
      take: 10,
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        content: true,
        requirements: true,
      },
    });

    expect(result).toEqual(mockPolicies);
  });

  it('should apply search filter when provided', async () => {
    const searchTerm = 'test';
    const result = await getAvailablePolicies(mockUserId, mockAgentId, searchTerm);

    expect(db.agentCertaPolicy.findMany).toHaveBeenCalledWith({
      where: {
        aiAgentId: mockAgentId,
        title: {
          contains: searchTerm,
          mode: Prisma.QueryMode.insensitive,
        },
      },
      take: 10,
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        content: true,
        requirements: true,
      },
    });

    expect(result).toEqual(mockPolicies);
  });

  it('should apply custom limit when provided', async () => {
    const limit = 5;
    const result = await getAvailablePolicies(mockUserId, mockAgentId, undefined, limit);

    expect(db.agentCertaPolicy.findMany).toHaveBeenCalledWith({
      where: {
        aiAgentId: mockAgentId,
      },
      take: limit,
      orderBy: { title: 'asc' },
      select: {
        id: true,
        title: true,
        content: true,
        requirements: true,
      },
    });

    expect(result).toEqual(mockPolicies);
  });

  it('should return an empty array if the user does not have access', async () => {
    (db.aiAgent.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getAvailablePolicies(mockUserId, mockAgentId);

    expect(result).toEqual([]);
  });

  it('should handle database errors', async () => {
    const error = new Error('Database error');
    (db.aiAgent.findFirst as jest.Mock).mockRejectedValue(error);

    await expect(getAvailablePolicies(mockUserId, mockAgentId)).rejects.toThrow('Error fetching available policies');
  });

  it('should not fetch policies from an agent with a different ID', async () => {
    const differentAgentId = '38a8c8e0-1a68-4839-9cd6-fa05b0067424';

    (db.aiAgent.findFirst as jest.Mock).mockResolvedValue(null);

    const result = await getAvailablePolicies(mockUserId, differentAgentId);

    expect(db.aiAgent.findFirst).toHaveBeenCalledWith({
      where: {
        id: differentAgentId,
        userGroups: {
          some: {
            userGroupMemberships: {
              some: {
                userId: mockUserId,
              },
            },
          },
        },
      },
    });

    expect(db.agentCertaPolicy.findMany).not.toHaveBeenCalled();
    expect(result).toEqual([]);
  });
});
