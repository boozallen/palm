import { Prisma } from '@prisma/client';

import db from '@/server/db';
import logger from '@/server/logger';

// What people actually typed, for the theme roll-up. A chat's summary is a title —
// it names the task ("pricing volume outline") and drops the pursuit the task is
// for, which is the thing the Value tab is asked about. The pursuit is in the
// conversation, so the roll-up reads the conversation.

// Read further into a message than we quote from it: a pasted solicitation puts
// its own header first and the ask second, and we want the term match to see both.
const SCAN_LENGTH = 600;
const EXCERPT_LENGTH = 200;
const MESSAGES_SCANNED_PER_CHAT = 8;
// One excerpt per chat times the 400-chat prompt cap is the input budget this has
// to live inside, so a chat contributes its opening ask plus at most one more.
const MAX_EXCERPTS_PER_CHAT = 2;

// How people write when they name what they are bidding. This only decides which
// message gets quoted — the model does the naming, and a pursuit these terms miss
// still reaches it in the opening ask.
const PURSUIT_TERMS = [
  'rfp',
  'rfi',
  'solicitation',
  'sources sought',
  'recompete',
  're-compete',
  'task order',
  'opportunity',
  'proposal',
  'bid',
  'capture',
  'incumbent',
  'contract vehicle',
];

type MessageRow = {
  chatId: string;
  content: string;
  position: bigint;
};

function clean(content: string): string {
  const collapsed = content.replace(/\s+/g, ' ').trim();
  return collapsed.length > EXCERPT_LENGTH
    ? `${collapsed.slice(0, EXCERPT_LENGTH).trimEnd()}…`
    : collapsed;
}

function namesAPursuit(content: string): boolean {
  const lowered = content.toLowerCase();
  return PURSUIT_TERMS.some((term) => lowered.includes(term));
}

export default async function getChatRequestExcerpts(
  chatIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();

  if (chatIds.length === 0) {
    return result;
  }

  try {
    // Truncated and row-limited in the database rather than in JS: the alternative
    // is pulling every message of several hundred chats across the wire to discard
    // almost all of it.
    const rows = await db.$queryRaw<MessageRow[]>`
      SELECT "chatId", content, position
      FROM (
        SELECT cm."chatId",
          -- ::int because a bound JS number arrives as bigint, and left() has no
          -- bigint overload, so the query fails outright without the cast.
          left(cm.content, ${SCAN_LENGTH}::int) AS content,
          row_number() OVER (PARTITION BY cm."chatId" ORDER BY cm."createdAt" ASC) AS position
        FROM "ChatMessage" cm
        WHERE cm.role = 'user'
          AND cm."chatId" IN (${Prisma.join(chatIds.map((id) => Prisma.sql`${id}::uuid`))})
      ) scanned
      WHERE position <= ${MESSAGES_SCANNED_PER_CHAT}::int
      ORDER BY "chatId", position
    `;

    const messagesByChat = new Map<string, string[]>();
    rows.forEach((row) => {
      const list = messagesByChat.get(row.chatId) ?? [];
      list.push(row.content ?? '');
      messagesByChat.set(row.chatId, list);
    });

    messagesByChat.forEach((messages, chatId) => {
      const excerpts: string[] = [];
      const opening = messages.find((message) => clean(message).length > 0);

      if (opening !== undefined) {
        excerpts.push(clean(opening));
      }

      // The opening ask is often "help me brainstorm win themes" with the pursuit
      // named three turns later, which is exactly the case a title cannot cover.
      const named = messages.find((message) => (
        message !== opening && namesAPursuit(message) && clean(message).length > 0
      ));

      if (named !== undefined && excerpts.length < MAX_EXCERPTS_PER_CHAT) {
        excerpts.push(clean(named));
      }

      if (excerpts.length > 0) {
        result.set(chatId, excerpts);
      }
    });

    return result;
  } catch (error) {
    logger.error('Failed to load chat request excerpts', { error });
    throw new Error('Failed to fetch chat request excerpts');
  }
}
