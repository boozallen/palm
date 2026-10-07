import { z } from 'zod';

export const joinUserGroupSchema = z.object({
  code: z.string().length(8).regex(/^[a-zA-Z0-9]+$/),
});

export type JoinUserGroup = z.infer<typeof joinUserGroupSchema>
