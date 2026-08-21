import db from '@/server/db';
import logger from '@/server/logger';

export type WorkspaceStats = {
  chatsLast30Days: number;
  documentsUploadedLast30Days: number;
  artifactsGeneratedLast30Days: number;
  citationsGeneratedLast30Days: number;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Workspace-wide aggregate totals; non-user-scoped and contain no PII.
export default async function getWorkspaceStats(): Promise<WorkspaceStats> {
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * MS_PER_DAY);

    const [
      chatsLast30Days,
      documentsUploadedLast30Days,
      artifactsGeneratedLast30Days,
      citationsGeneratedLast30Days,
    ] = await Promise.all([
      db.chat.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      db.document.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      db.chatArtifact.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      db.chatMessageCitation.count({ where: { message: { createdAt: { gte: thirtyDaysAgo } } } }),
    ]);

    return {
      chatsLast30Days,
      documentsUploadedLast30Days,
      artifactsGeneratedLast30Days,
      citationsGeneratedLast30Days,
    };
  } catch (error) {
    logger.error('Error getting workspace stats', error);
    throw new Error('Error getting workspace stats');
  }
}
