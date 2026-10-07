import ownedArtifactWhere from '@/features/chat/dal/ownedArtifactWhere';
import extractArtifactText, {
  canExtractArtifactText,
} from '@/features/chat/utils/artifacts/extractArtifactText';
import {
  ARTIFACT_PREVIEW_CHARS,
  ARTIFACT_SEARCH_PAGE_SIZE,
} from '@/features/graph-database/config/conversation-graph.config';
import { endOfCodePoint } from '@/features/shared/utils/surrogatePairs';
import db from '@/server/db';
import logger from '@/server/logger';

type FindArtifactsInput = {
  userId: string;
  label?: string;
  fileExtension?: string;
  sinceDays?: number;
  cursor?: number;
};

export type FoundArtifact = {
  id: string;
  label: string;
  fileExtension: string;
  createdAt: Date;
  chatId: string;
  chatTitle: string | null;
  messageId: string;
  contentPreview: string;
};

export default async function findArtifacts({
  userId,
  label,
  fileExtension,
  sinceDays,
  cursor = 0,
}: FindArtifactsInput): Promise<FoundArtifact[]> {
  const normalizedLabel = label?.trim();
  const trimmedFileExtension = fileExtension?.trim();
  // Extensions are stored as the model wrote them, so match without regard to case.
  const fileExtensionFilter = trimmedFileExtension
    ? (trimmedFileExtension.startsWith('.')
        ? { equals: trimmedFileExtension, mode: 'insensitive' as const }
        : { in: [trimmedFileExtension, `.${trimmedFileExtension}`], mode: 'insensitive' as const })
    : undefined;

  try {
    const artifacts = await db.chatArtifact.findMany({
      where: {
        ...ownedArtifactWhere(userId),
        ...(normalizedLabel
          ? { label: { contains: normalizedLabel, mode: 'insensitive' as const } }
          : {}),
        ...(fileExtensionFilter
          ? { fileExtension: fileExtensionFilter }
          : {}),
        ...(sinceDays === undefined
          ? {}
          : {
              createdAt: {
                gte: new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000),
              },
            }),
      },
      select: {
        id: true,
        label: true,
        fileExtension: true,
        createdAt: true,
        content: true,
        sourceScript: true,
        sourceJson: true,
        chatMessageId: true,
        message: {
          select: {
            chatId: true,
            chat: {
              select: {
                summary: true,
              },
            },
          },
        },
      },
      orderBy: [
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      take: ARTIFACT_SEARCH_PAGE_SIZE,
      skip: cursor,
    });

    const extractedTextById = await extractTextForBinaryArtifacts(userId, artifacts);

    return artifacts.map((artifact) => {
      const extractedText = extractedTextById.get(artifact.id);
      let representation = '';
      if (artifact.content.length > 0) {
        representation = artifact.content;
      } else if (extractedText !== undefined) {
        representation = extractedText;
      } else if (artifact.sourceScript !== null) {
        representation = artifact.sourceScript;
      } else if (artifact.sourceJson !== null) {
        representation = JSON.stringify(artifact.sourceJson);
      }

      return {
        id: artifact.id,
        label: artifact.label,
        fileExtension: artifact.fileExtension,
        createdAt: artifact.createdAt,
        chatId: artifact.message.chatId,
        chatTitle: artifact.message.chat.summary,
        messageId: artifact.chatMessageId,
        contentPreview: representation.slice(0, endOfCodePoint(representation, ARTIFACT_PREVIEW_CHARS)),
      };
    });
  } catch (error) {
    logger.error('Error finding artifacts', { userId, error });
    throw new Error('Error finding artifacts');
  }
}

// Generated Office artifacts store the document as bytes with an empty content column, so
// without this their preview would be the opening of a generation script. Bytes are loaded
// only for the rows on this page that need them.
async function extractTextForBinaryArtifacts(
  userId: string,
  artifacts: Array<{ id: string; fileExtension: string; content: string }>,
): Promise<Map<string, string>> {
  const extractedTextById = new Map<string, string>();
  const ids = artifacts
    .filter((artifact) => artifact.content.length === 0 && canExtractArtifactText(artifact.fileExtension))
    .map((artifact) => artifact.id);
  if (ids.length === 0) {
    return extractedTextById;
  }

  const rows = await db.chatArtifact.findMany({
    where: {
      id: { in: ids },
      ...ownedArtifactWhere(userId),
    },
    select: {
      id: true,
      fileExtension: true,
      binaryContent: true,
    },
  });

  await Promise.all(rows.map(async (row) => {
    if (!row.binaryContent) {
      return;
    }
    const text = await extractArtifactText(row.id, row.fileExtension, row.binaryContent);
    if (text !== null) {
      extractedTextById.set(row.id, text);
    }
  }));

  return extractedTextById;
}
