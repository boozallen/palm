import getUserFirstAvailableOpenAiModel from '@/features/shared/dal/getUserFirstAvailableOpenAiModel';
import { procedure } from '@/server/trpc';

export default procedure
  .query(async ({ ctx }) => {

    const model = await getUserFirstAvailableOpenAiModel(ctx.userId);

    return !!model;
  });
