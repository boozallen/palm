import { router } from '@/server/trpc';

import chatRoutes from '@/features/chat/routes';
import libraryRoutes from '@/features/library/routes';
import playgroundRoutes from '@/features/playground/routes';
import profileRoutes from '@/features/profile/routes';
import sharedRoutes from '@/features/shared/routes';
import settingsRoutes from '@/features/settings/routes';
import promptGeneratorRoutes from '@/features/prompt-generator/routes';
import aiAgentsRoutes from '@/features/ai-agents/routes';

export const serverRouter = router({
  chat: chatRoutes,
  library: libraryRoutes,
  playground: playgroundRoutes,
  profile: profileRoutes,
  shared: sharedRoutes,
  settings: settingsRoutes,
  promptGenerator: promptGeneratorRoutes,
  aiAgents: aiAgentsRoutes,
});

export type ServerRouter = typeof serverRouter;
