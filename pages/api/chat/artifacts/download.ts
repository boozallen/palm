import { getServerSession } from 'next-auth/next';
import type { NextApiHandler } from 'next';

import { authOptions } from '@/server/auth-adapter';
import { logger } from '@/server/logger';
import db from '@/server/db';
import { GitHubFactory } from '@/features/github-provider/factory';
import getAvailableGitHubProviders from '@/features/shared/dal/getAvailableGitHubProviders';
import { BINARY_FILE_DOWNLOAD_MAP } from '@/features/shared/types/document';
import { createAuditor } from '@/server/auditor';
import {
  AuditRecordEvent,
  AuditRecordOutcome,
  AuditRecordResourceType,
} from '@/features/shared/types/audit-record';
import { withErrorReporting } from '@/server/withErrorReporting';

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const session = await getServerSession(req, res, await authOptions());
  if (!session?.user?.id) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const auditor = createAuditor({ userId: session.user.id, referer: req.headers.referer ?? null });

  const artifactId = typeof req.query['id'] === 'string' ? req.query['id'] : '';
  if (!artifactId) {
    res.status(400).json({ error: 'Missing required query parameter: id' });
    return;
  }

  try {
    const results = await db.$queryRaw<Array<{
      binaryContent: Buffer | null;
      content: string;
      githubUrl: string | null;
      fileExtension: string;
      label: string;
      chatMessageId: string;
      chatId: string;
    }>>`
      SELECT a."binaryContent", a.content, a."githubUrl", a."fileExtension", a.label,
             a."chatMessageId", m."chatId"
      FROM "ChatArtifact" a
      JOIN "ChatMessage" m ON m.id = a."chatMessageId"
      JOIN "Chat" c ON c.id = m."chatId"
      WHERE a.id = ${artifactId}::uuid
        AND c."userId" = ${session.user.id}::uuid
      LIMIT 1
    `;

    const artifact = results[0];

    if (!artifact) {
      res.status(404).json({ error: 'Artifact not found' });
      return;
    }

    let binaryContent = artifact.binaryContent;
    let isTextFallback = false;

    if (!binaryContent && artifact.githubUrl) {
      const providers = await getAvailableGitHubProviders(session.user.id);
      if (providers.length === 0) {
        res.status(404).json({ error: 'No GitHub provider available to fetch file' });
        return;
      }

      const provider = providers[0];
      const baseUrl = `${new URL(provider.apiBaseUrl).protocol}//${new URL(provider.apiBaseUrl).hostname}`;
      const urlPath = artifact.githubUrl.replace(baseUrl, '').replace(/^\//, '');
      const [owner, repo, , branch, ...rest] = urlPath.split('/');
      const filePath = rest.join('/');

      logger.info(`[ARTIFACT-DOWNLOAD] Fetching from GitHub: owner=${owner}, repo=${repo}, branch=${branch}, filePath=${filePath}`);
      logger.info(`[ARTIFACT-DOWNLOAD] Parsed from URL: ${artifact.githubUrl}, baseUrl: ${baseUrl}, urlPath: ${urlPath}`);

      const factory = new GitHubFactory({ userId: session.user.id });
      const { source } = await factory.buildSource(provider.id);
      const result = await source.getBinaryFile({ owner, repo, filePath, branch });
      binaryContent = result.content;

      logger.info(`[ARTIFACT-DOWNLOAD] GitHub fetch returned ${result.content.length} bytes`);
    }

    if (!binaryContent) {
      binaryContent = Buffer.from(artifact.content, 'utf-8');
      isTextFallback = true;
    }

    const buffer = Buffer.isBuffer(binaryContent) ? binaryContent : Buffer.from(binaryContent);

    if (buffer.length === 0) {
      logger.error(`[ARTIFACT-DOWNLOAD] Artifact ${artifactId} resolved to 0 bytes (isTextFallback=${isTextFallback})`);
      await auditor.createAuditRecord({
        event: AuditRecordEvent.DownloadArtifact,
        outcome: AuditRecordOutcome.Error,
        description: `Failed to download chat artifact "${artifact.label}${artifact.fileExtension}": no content available`,
        metadata: {
          resourceType: AuditRecordResourceType.ChatArtifact,
          resourceIds: [artifactId],
          chatMessageId: artifact.chatMessageId,
          chatId: artifact.chatId,
        },
      });
      res.status(404).json({ error: 'No content available for this artifact' });
      return;
    }

    const contentType = isTextFallback
      ? 'text/plain; charset=utf-8'
      : BINARY_FILE_DOWNLOAD_MAP[artifact.fileExtension.toLowerCase()] || 'application/octet-stream';
    // Sanitize the label for use in Content-Disposition header — strip control chars and special characters.
    const sanitizedFilename = `${artifact.label
      .toLowerCase()
      .replace(/[\r\n\t]+/g, '-')
      .replace(/[^\w\s.-]/g, '')
      .trim()
      .replaceAll(' ', '-')
      .replace(/-+/g, '-')}${artifact.fileExtension}`;

    logger.info(`[ARTIFACT-DOWNLOAD] Serving ${sanitizedFilename}, size: ${buffer.length} bytes`);

    // Same event and wording the client records for a browser-built download —
    // the code path is an implementation detail, so both read alike in reports.
    await auditor.createAuditRecord({
      event: AuditRecordEvent.DownloadArtifact,
      outcome: AuditRecordOutcome.Success,
      description: `User downloaded chat artifact "${sanitizedFilename}"`,
      metadata: {
        resourceType: AuditRecordResourceType.ChatArtifact,
        resourceIds: [artifactId],
        filenames: [sanitizedFilename],
        chatMessageId: artifact.chatMessageId,
        chatId: artifact.chatId,
      },
    });

    res
      .status(200)
      .setHeader('Content-Type', contentType)
      .setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"`)
      .setHeader('Content-Length', buffer.length)
      .end(buffer);
  } catch (error) {
    logger.error('Error downloading artifact:', error);
    await auditor.createAuditRecord({
      event: AuditRecordEvent.DownloadArtifact,
      outcome: AuditRecordOutcome.Error,
      description: `Failed to download chat artifact ${artifactId}: ${(error as Error).message}`,
      metadata: {
        resourceType: AuditRecordResourceType.ChatArtifact,
        resourceIds: [artifactId],
      },
    });
    res.status(500).json({ error: 'Failed to download artifact' });
  }
};

export default withErrorReporting(handler);
