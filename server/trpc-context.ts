import { authOptions } from '@/server/auth-adapter';
import type { PrismaClient } from '@prisma/client';
import globalLogger from '@/server/logger';
import { createAuditor, Auditor } from '@/server/auditor';
import type { NextApiRequest, NextApiResponse } from 'next/types';
import prisma from '@/server/db';
import { getServerSession } from 'next-auth/next';
import { AIFactory } from '@/features/ai-provider';
import { KBFactory } from '@/features/kb-provider';
import { UserRole } from '@/features/shared/types/user';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';
import getAccessibleDocumentIds from '@/features/shared/dal/getAccessibleDocumentIds';

export type ContextType = {
  userId: string,
  userRole: UserRole,
  prisma: PrismaClient,
  logger: typeof globalLogger,
  auditor: Auditor,
  ai: AIFactory,
  kb: KBFactory,
  getAccessibleDocIds: () => Promise<AccessibleDocIds>,
}

export async function createContext({ req, res }: { req: NextApiRequest, res: NextApiResponse }): Promise<ContextType> {
  // const reqProps = [
  //   'url', 'method', 'cookies',
  //   'query', 'body', 'httpVersion',
  // ] as const;
  try {
    const session = await getServerSession(req, res, authOptions);
    const userId = session?.user.id;
    const userRole = session?.user.role ?? UserRole.User;
    const referer = req.headers.referer;

    if (!userId) {
      globalLogger.error('session or the session user was not found');
      throw new Error('An unexpected error occurred. Please try again later.');
    }

    const logger = globalLogger.child({ userId });

    const auditor = createAuditor({
      userId,
      referer,
    });

    const ai = new AIFactory({ userId });
    const kb = new KBFactory({ userId });

    let accessibleDocIdsCache: AccessibleDocIds | undefined;
    const getAccessibleDocIds = async (): Promise<AccessibleDocIds> => {
      if (!accessibleDocIdsCache) {
        accessibleDocIdsCache = await getAccessibleDocumentIds(userId);
      }
      return accessibleDocIdsCache;
    };

    return { userId, userRole, prisma, logger, auditor, ai, kb, getAccessibleDocIds };
  } catch (error) {
    globalLogger.error('Failed to create tRPC context', error);
    throw new Error('An unexpected error occurred. Please try again later.');
  }
}
