import ownedArtifactWhere from '@/features/chat/dal/ownedArtifactWhere';
import extractArtifactText, {
  canExtractArtifactText,
} from '@/features/chat/utils/artifacts/extractArtifactText';
import { CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS } from '@/features/graph-database/config/conversation-graph.config';
import { endOfCodePoint, startOfCodePoint } from '@/features/shared/utils/surrogatePairs';
import db from '@/server/db';
import logger from '@/server/logger';

type GetConversationArtifactInput = {
  userId: string;
  artifactId: string;
  cursor?: number;
};

const BINARY_ARTIFACT_NOTICE = 'Binary artifact; content not readable here. The user can download it from the source conversation.';

export default async function getConversationArtifact({
  userId,
  artifactId,
  cursor = 0,
}: GetConversationArtifactInput) {
  let artifact;
  try {
    artifact = await db.chatArtifact.findFirst({
      where: {
        id: artifactId,
        ...ownedArtifactWhere(userId),
      },
      select: {
        id: true,
        label: true,
        fileExtension: true,
        createdAt: true,
        sourceScript: true,
        sourceJson: true,
        content: true,
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
    });
  } catch (error) {
    logger.error('Error fetching conversation artifact', { userId, artifactId, error });
    throw new Error('Error fetching conversation artifact');
  }

  if (!artifact) {
    throw new Error('Artifact not found');
  }

  const metadata = {
    id: artifact.id,
    label: artifact.label,
    fileExtension: artifact.fileExtension,
    createdAt: artifact.createdAt,
    chatId: artifact.message.chatId,
    chatTitle: artifact.message.chat.summary,
    messageId: artifact.chatMessageId,
  };

  let contentType: 'text' | 'extracted-text' | 'generation-script' | 'docx-source-json';
  let representation: string;
  if (artifact.content.length > 0) {
    contentType = 'text';
    representation = artifact.content;
  } else {
    const extractedText = canExtractArtifactText(artifact.fileExtension)
      ? await extractStoredDocumentText(userId, artifactId, artifact.fileExtension)
      : null;
    if (extractedText !== null) {
      contentType = 'extracted-text';
      representation = extractedText;
    } else if (artifact.sourceScript !== null) {
      contentType = 'generation-script';
      representation = artifact.sourceScript;
    } else if (artifact.sourceJson !== null) {
      contentType = 'docx-source-json';
      representation = JSON.stringify(artifact.sourceJson);
    } else if (await hasBinaryContent(userId, artifactId)) {
      return {
        ...metadata,
        contentType: 'binary' as const,
        notice: BINARY_ARTIFACT_NOTICE,
      };
    } else {
      contentType = 'text';
      representation = '';
    }
  }

  const contentLength = representation.length;
  cursor = startOfCodePoint(representation, cursor);
  const end = endOfCodePoint(representation, cursor + CONVERSATION_ARTIFACT_CONTENT_PAGE_CHARS);
  const nextCursor = end < contentLength ? end : null;
  if (nextCursor !== null) {
    logger.info('Conversation artifact content paginated', {
      userId,
      artifactId,
      contentLength,
      cursor,
    });
  }

  return {
    ...metadata,
    contentType,
    content: representation.slice(cursor, end),
    contentLength,
    cursor,
    nextCursor,
  };
}

// Loads the stored bytes only for file types that can be read as text, so a video's bytes
// are never pulled just to report that it is binary.
async function extractStoredDocumentText(
  userId: string,
  artifactId: string,
  fileExtension: string,
): Promise<string | null> {
  let row;
  try {
    row = await db.chatArtifact.findFirst({
      where: {
        id: artifactId,
        ...ownedArtifactWhere(userId),
      },
      select: { binaryContent: true },
    });
  } catch (error) {
    logger.error('Error fetching conversation artifact', { userId, artifactId, error });
    throw new Error('Error fetching conversation artifact');
  }
  if (!row?.binaryContent) {
    return null;
  }
  return extractArtifactText(artifactId, fileExtension, row.binaryContent);
}

async function hasBinaryContent(userId: string, artifactId: string): Promise<boolean> {
  try {
    const binaryCount = await db.chatArtifact.count({
      where: {
        id: artifactId,
        binaryContent: { not: null },
        ...ownedArtifactWhere(userId),
      },
    });
    return binaryCount > 0;
  } catch (error) {
    logger.error('Error fetching conversation artifact', { userId, artifactId, error });
    throw new Error('Error fetching conversation artifact');
  }
}
