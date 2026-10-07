import db from '@/server/db';
import logger from '@/server/logger';

type UpdateChatUseCaseInput = {
  id: string;
  useCase: string;
};

// Sets the category and nothing else. Separate from updateChatConversationSummary
// because the title is established the instant a chat is created and the category
// only once the assistant has answered, so a single writer would be handed a summary
// it has no business changing. Not nullable: clearing a category is not something
// anything needs, and making it unexpressible keeps a failed classification from
// erasing a good answer.
//
// The `useCase: null` in the filter is what makes first-writer-wins a property of the
// database rather than of the caller. Two turns of the same chat finishing together
// can both read a null category and both classify; this clause means only one of them
// can land, so the other's answer is discarded instead of overwriting a category
// somebody may already be reading. updateMany rather than update because a filter on
// a non-unique column is not a valid `update` where — and because a filtered write
// that matches nothing is an expected outcome here, not the P2025 that `update`
// would throw.
export default async function updateChatUseCase(input: UpdateChatUseCaseInput): Promise<void> {
  try {
    await db.chat.updateMany({
      where: { id: input.id, useCase: null },
      data: { useCase: input.useCase },
    });
  } catch (error) {
    logger.error(`Error updating chat use case: ChatId: ${input.id}`, error);
    throw new Error('Error updating chat use case');
  }
}
