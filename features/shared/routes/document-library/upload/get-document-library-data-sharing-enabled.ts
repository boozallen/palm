import { z } from 'zod';
import { procedure } from '@/server/trpc';
import getSystemConfig from '@/features/shared/dal/getSystemConfig';

const outputSchema = z.object({
  enabled: z.boolean(),
});

export default procedure
  .output(outputSchema)
  .query(async () => {
    const result = await getSystemConfig();
    
    return {
      enabled: result.documentLibraryDataSharingEnabled ?? false,
    };
  });