import { storageModel } from '@/features/graph-database/config/storage-model.config';
import { signalsConfig } from '@/features/graph-database/config/signals.config';
import { resolutionPolicy } from '@/features/graph-database/config/resolution-policy.config';
import { queryRules } from '@/features/graph-database/config/query-rules.config';
import logger from '@/server/logger';

/**
 * Validates all GraphRAG configuration files on application startup.
 * Throws if any config is invalid or incomplete.
 *
 * This is called during app initialization
 */
export function validateAllConfigs(): void {
  // Validate storage model
  if (!storageModel.nodeTypes || Object.keys(storageModel.nodeTypes).length === 0) {
    throw new Error('Storage model must define node types');
  }
  if (!storageModel.edgeTypes || Object.keys(storageModel.edgeTypes).length === 0) {
    throw new Error('Storage model must define edge types');
  }

  // Validate signals config
  if (!signalsConfig.signals || signalsConfig.signals.length === 0) {
    throw new Error('Signals config must define signals');
  }
  if (!signalsConfig.candidateRules || signalsConfig.candidateRules.length === 0) {
    throw new Error('Signals config must define candidate rules');
  }
  if (!signalsConfig.aliasFilters) {
    throw new Error('Signals config must define alias filters');
  }
  if (!signalsConfig.candidateLimits) {
    throw new Error('Signals config must define candidate limits');
  }
  if (!signalsConfig.blocking) {
    throw new Error('Signals config must define blocking parameters');
  }
  if (
    typeof signalsConfig.blocking.similarityThreshold !== 'number' ||
    typeof signalsConfig.blocking.maxBlockSize !== 'number' ||
    typeof signalsConfig.blocking.smallBlockMaxForPartition !== 'number' ||
    typeof signalsConfig.blocking.anchorBatchSize !== 'number'
  ) {
    throw new Error('Signals config blocking parameters are incomplete');
  }

  // Validate resolution policy
  if (!resolutionPolicy.policyVersion) {
    throw new Error('Resolution policy must have version');
  }
  if (!resolutionPolicy.triples || resolutionPolicy.triples.length === 0) {
    throw new Error('Resolution policy must define triple policies');
  }

  // Validate query rules
  if (!queryRules.profiles || queryRules.profiles.length === 0) {
    throw new Error('Query rules must define profiles');
  }

  logger.info('✓ All GraphRAG configurations validated successfully');
  logger.info(`  Resolution policy version: ${resolutionPolicy.policyVersion}`);
  logger.info(`  Node types: ${Object.keys(storageModel.nodeTypes).join(', ')}`);
  logger.info(`  Enabled edge types: ${resolutionPolicy.edges.filter(e => e.enabled).map(e => e.edgeType).join(', ')}`);
}
