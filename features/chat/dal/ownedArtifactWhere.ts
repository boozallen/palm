import { Prisma } from '@prisma/client';

// The access wall for every artifact read on behalf of a user: an artifact is
// reachable only through a message in a chat the user owns. Spread this into the
// `where` of each query so a foreign id is indistinguishable from a missing id.
export default function ownedArtifactWhere(userId: string): Prisma.ChatArtifactWhereInput {
  return {
    message: {
      chat: {
        userId,
      },
    },
  };
}
