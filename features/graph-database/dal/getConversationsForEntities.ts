import { getGraphDatabaseSource } from '@/features/graph-database';
import {
  CONVERSATIONS_FOR_ENTITIES_CHAT_LIMIT,
  CONVERSATIONS_FOR_ENTITIES_MATCHES_PER_CHAT,
} from '@/features/graph-database/config/conversation-graph.config';
import { expandIdentityClusters } from '@/features/graph-database/dal/expandIdentityClusters';
import db from '@/server/db';
import logger from '@/server/logger';
import type { AccessibleDocIds } from '@/features/shared/types/AccessibleDocIds';

type GetConversationsForEntitiesInput = {
  userId: string;
  ids: string[];
  accessibleDocumentIds: AccessibleDocIds;
};

type ConversationEntityMatch = {
  messageId: string;
  position: number;
  targetId: string;
  targetName: string | null;
};

export type ConversationForEntities = {
  chatId: string;
  title: string | null;
  distinctTargets: number;
  totalMatches: number;
  matches: ConversationEntityMatch[];
};

type ClusterTarget = {
  id: string;
  seedId: string;
};

// Both ORDER BYs are needed: the first decides which chats survive the LIMIT,
// the second guarantees output order (Cypher does not promise it survives
// RETURN). The chatId tiebreak makes both deterministic across runs.
// distinctTargets counts SEEDS, not nodes: identity-cluster siblings of one
// requested id — and multiple requested ids that resolve to one cluster —
// rank as one topic, not several.
// The label anchor keeps arbitrary ids from matching non-content nodes (Chat,
// Message, Artifact); each id's true kind is reported by the searchedFor echo
// upstream. The documentId check keeps matches — and the names they carry —
// behind the same accessible-document wall as that echo.
const FIND_CONVERSATIONS_QUERY = `
  UNWIND $targets AS tgt
  MATCH (m:Message {userId: $userId})-[:REFERENCED]->(t:Entity|Concept {id: tgt.id})
  WHERE t.documentId IN $documentIds
  WITH m.chatId AS chatId,
       collect(DISTINCT {
         messageId: m.id, position: m.position, targetId: t.id, targetName: t.name
       }) AS matches,
       count(DISTINCT tgt.seedId) AS distinctTargets
  WITH chatId, matches, distinctTargets, size(matches) AS totalMatches
  ORDER BY distinctTargets DESC, chatId
  LIMIT ${CONVERSATIONS_FOR_ENTITIES_CHAT_LIMIT}
  RETURN chatId,
         matches[0..${CONVERSATIONS_FOR_ENTITIES_MATCHES_PER_CHAT}] AS matches,
         distinctTargets,
         totalMatches
  ORDER BY distinctTargets DESC, chatId
`;

const toNumber = (value: unknown): number => {
  if (
    typeof value === 'object'
    && value !== null
    && 'toNumber' in value
    && typeof value.toNumber === 'function'
  ) {
    return value.toNumber();
  }
  return Number(value);
};

// Each seed id widens to its full identity-cluster membership, so a citation
// of any document's copy of the same real-world thing matches. A node reached
// from two seeds is attributed to the first, keeping targets unique per node.
const buildClusterTargets = (
  seedIds: string[],
  clusterMap: Map<string, string[]>,
): ClusterTarget[] => {
  const targets: ClusterTarget[] = [];
  const seen = new Set<string>();
  for (const seedId of seedIds) {
    for (const memberId of clusterMap.get(seedId) ?? [seedId]) {
      if (seen.has(memberId)) {
        continue;
      }
      seen.add(memberId);
      targets.push({ id: memberId, seedId });
    }
  }
  return targets;
};

export default async function getConversationsForEntities({
  userId,
  ids,
  accessibleDocumentIds,
}: GetConversationsForEntitiesInput): Promise<ConversationForEntities[]> {
  const seedIds = [...new Set(ids)];
  if (seedIds.length === 0) {
    return [];
  }

  try {
    const documentIds = Array.from(accessibleDocumentIds);
    const clusterMap = await expandIdentityClusters(seedIds, documentIds);
    const targets = buildClusterTargets(seedIds, clusterMap);

    const graphDb = await getGraphDatabaseSource();
    const result = await graphDb.run(FIND_CONVERSATIONS_QUERY, {
      userId,
      documentIds,
      targets,
    });
    const graphMatches = result.records.map((record) => ({
      chatId: record.get('chatId') as string,
      matches: (record.get('matches') as Array<Record<string, unknown>>).map((match) => ({
        messageId: String(match.messageId),
        position: toNumber(match.position),
        targetId: String(match.targetId),
        targetName: match.targetName === null || match.targetName === undefined
          ? null
          : String(match.targetName),
      })),
      distinctTargets: toNumber(record.get('distinctTargets')),
      totalMatches: toNumber(record.get('totalMatches')),
    }));
    if (graphMatches.length === CONVERSATIONS_FOR_ENTITIES_CHAT_LIMIT) {
      logger.info('Conversation entity lookup hit conversation limit', {
        userId,
        limit: CONVERSATIONS_FOR_ENTITIES_CHAT_LIMIT,
      });
    }
    if (graphMatches.length === 0) {
      return [];
    }

    const chats = await db.chat.findMany({
      where: {
        id: { in: graphMatches.map(({ chatId }) => chatId) },
        userId,
      },
      select: {
        id: true,
        summary: true,
      },
    });
    const titlesByChatId = new Map(chats.map((chat) => [chat.id, chat.summary]));

    return graphMatches.flatMap((match) => {
      if (!titlesByChatId.has(match.chatId)) {
        return [];
      }
      return [{
        ...match,
        title: titlesByChatId.get(match.chatId) ?? null,
      }];
    });
  } catch (error) {
    logger.error('Error finding conversations for entities', { userId, error });
    throw new Error('Error finding conversations for entities');
  }
}
