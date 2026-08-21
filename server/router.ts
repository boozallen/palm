import { router } from '@/server/trpc';

import contextStudioRoutes from '@/features/context-studio/routes';
import chatRoutes from '@/features/chat/routes';
import libraryRoutes from '@/features/library/routes';
import playgroundRoutes from '@/features/playground/routes';
import profileRoutes from '@/features/profile/routes';
import sharedRoutes from '@/features/shared/routes';
import settingsRoutes from '@/features/settings/routes';
import promptGeneratorRoutes from '@/features/prompt-generator/routes';
import aiAgentsRoutes from '@/features/ai-agents/routes';
import workflowRoutes from '@/features/workflows/routes';
import graphRoutes from '@/features/graph-database/routes';
import videoRoutes from '@/features/video-generation/routes';

export const serverRouter = router({
  contextStudio: contextStudioRoutes,
  chat: chatRoutes,
  library: libraryRoutes,
  playground: playgroundRoutes,
  profile: profileRoutes,
  shared: sharedRoutes,
  settings: settingsRoutes,
  promptGenerator: promptGeneratorRoutes,
  aiAgents: aiAgentsRoutes,
  workflows: workflowRoutes,
  graph: graphRoutes,
  video: videoRoutes,
});

export type ServerRouter = typeof serverRouter;
