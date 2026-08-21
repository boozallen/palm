import { z } from 'zod';

import { procedure } from '@/server/trpc';
import getWorkspaceStats from '@/features/shared/dal/getWorkspaceStats';

const outputSchema = z.object({
  chatsLast30Days: z.number(),
  documentsUploadedLast30Days: z.number(),
  artifactsGeneratedLast30Days: z.number(),
  citationsGeneratedLast30Days: z.number(),
});

export default procedure.output(outputSchema).query(async () => {
  return getWorkspaceStats();
});
