import { Policy } from '@/features/ai-agents/types/certa/webPolicyCompliance';
import logger from '@/server/logger';
import db from '@/server/db';
import { Prisma } from '@prisma/client';

export default async function getAvailablePolicies(
  userId: string,
  agentId: string,
  searchTerm?: string,
  limit: number = 10
): Promise<Policy[]> {
  try {
    const hasAccess = await db.aiAgent.findFirst({
      where: {
        id: agentId,
        userGroups: {
          some: {
            userGroupMemberships: {
              some: {
                userId,
              },
            },
          },
        },
      },
    });

    if (!hasAccess) {
      return [];
    }

    const results = await db.agentCertaPolicy.findMany({
      where: {
        aiAgentId: agentId,
        ...(searchTerm ? {
          title: {
            contains: searchTerm,
            mode: Prisma.QueryMode.insensitive,
          },
        } : {}),
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

    const output: Policy[] =
      results.map((result) => ({
        aiAgentId: agentId,
        id: result.id,
        title: result.title,
        content: result.content,
        requirements: result.requirements,
      }));

    return output;
  } catch (error) {
    logger.error('Error fetching available polices', error);
    throw new Error('Error fetching available policies');
  }
}
