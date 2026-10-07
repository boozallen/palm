import { createNextApiHandler } from '@trpc/server/adapters/next';

import { serverRouter } from '@/server/router';
import { createContext } from '@/server/trpc-context';
import logger from '@/server/logger';
import { startCertaWorker } from '@/features/ai-agents/utils/certa/worker/worker';
import { startRadarWorker } from '@/features/ai-agents/utils/radar/worker/worker';
import { startRcastWorker } from '@/features/ai-agents/utils/rcast/worker/worker';
import { startSwearWorker } from '@/features/ai-agents/utils/swear/worker/worker';
import { startPrismWorker } from '@/features/ai-agents/utils/prism/worker/worker';
import { startOdramWorker } from '@/features/ai-agents/utils/odram/worker/worker';
import { startPulseWorker } from '@/features/ai-agents/utils/pulse/worker/worker';
import { startWorkflowWorker } from '@/features/workflows/utils/worker/worker';
import { startDeepResearchWorker } from '@/features/ai-provider/sources/deep-research/deepResearchWorker';
import { startChatWorker } from '@/features/chat/utils/worker/worker';
import { startAgentChatWorker } from '@/features/chat/utils/worker/agentWorker';
import { startPromptGeneratorWorker } from '@/features/prompt-generator/utils/worker/promptGeneratorWorker';
import { startPlaygroundWorker } from '@/features/playground/utils/worker/playgroundWorker';
import { startGraphCopyWorker } from '@/features/shared/utils/document-library/worker';
import { startPeriodicSync } from '@/server/services/repoSync';
import { startSessionExpiryReconciler } from '@/server/services/sessionExpiryReconciler';

/**
 * Background worker initialization
 * These workers start when the TRPC API server initializes, and handle asynchronous processing tasks.
 * Each worker runs independently and processes items from their respective job queues.
 */

// Worker: AI Agent - CERTA
// Handles web policy compliance checks
startCertaWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start CERTA worker:', err);
  }
});

// Worker: AI Agent - RADAR
// Handles arXiv API calls
startRadarWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start RADAR worker:', err);
  }
});

// Worker: AI Agent - RCAST
// Handles rate card processing with SOC mapping
startRcastWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start RCAST worker:', err);
  }
});

// Worker: AI Agent - SWEAR
// Handles search warrant document analysis
startSwearWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start SWEAR worker:', err);
  }
});

// Worker: AI Agent - PRISM
// Handles proposal compliance analysis with RAG
startPrismWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start PRISM worker:', err);
  }
});

// Worker: AI Agent - ODRAM
// Handles opportunity delivery risk assessment analysis
startOdramWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start ODRAM worker:', err);
  }
});

// Worker: AI Agent - PULSE
// Handles longform survey response extraction
startPulseWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start PULSE worker:', err);
  }
});

// Worker: Workflows
// Handles workflow primitive execution (LLM prompts, web scraping, report generation)
startWorkflowWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start Workflow worker:', err);
  }
});

// Worker: Deep Research
// Handles long-running, web-enabled LLM provider (OpenAI) API calls
startDeepResearchWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start DeepResearch worker:', err);
  }
});

// Worker: Chat
// Handles async chat completions with document processing and knowledge base retrieval
startChatWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start Chat worker:', err);
  }
});

// Worker: Agent Chat
// Handles async agent chat completions via external agent endpoint
startAgentChatWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start Agent Chat worker:', err);
  }
});

// Worker: Graph Copy
// Handles copying Neo4j graph data when accepting shared documents
startGraphCopyWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start Graph Copy worker:', err);
  }
});

// Worker: Video Render
// Handles server-side Remotion MP4 rendering jobs
// Note: runs in a dedicated video-render-worker container to avoid resource contention with main application

// Worker: Graph Build
// Handles knowledge graph construction with entity extraction and resolution
// Note: runs in a dedicated graph-build-worker container to avoid resource contention with main application

// Worker: Document Upload
// Handles document uploads process in the Document Library feature
// Note: runs in a dedicated document-upload-worker container to avoid resource contention with main application

// Worker: Prompt Generator
// Handles prompt-engineering LLM calls for the Prompt Generator feature
startPromptGeneratorWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start Prompt Generator worker:', err);
  }
});

// Worker: Prompt Playground
// Handles side-by-side prompt comparison LLM calls
startPlaygroundWorker().catch((err) => {
  if (!err.message.includes('Worker is already running')) {
    logger.debug('Failed to start Prompt Playground worker:', err);
  }
});

// Skill Repos: periodic refresh of all skill repos via repo-service
// Configured via GitHubProvider in database (with isSkillRepo=true).
startPeriodicSync();

// Context Studio: periodic sweep that closes out sessions whose client never
// got to report its own sign-out (tab closed, browser crash, laptop asleep),
// so the activity feed doesn't show them as "Still open" forever.
startSessionExpiryReconciler();

export default createNextApiHandler({
  router: serverRouter,
  createContext,
});
