import getSystemConfig from '@/features/shared/dal/getSystemConfig';

/**
 * Whether the entity-resolution phase runs. Sourced from the admin SystemConfig
 * toggle (`knowledgeGraphEntityResolutionEnabled`), replacing the former
 * ENTITY_RESOLUTION feature flag so resolution can be turned on/off from the
 * Settings UI. When on, resolution runs the V2 (blocking + cluster) algorithm.
 */
export async function isEntityResolutionEnabled(): Promise<boolean> {
  const config = await getSystemConfig();
  return config.knowledgeGraphEntityResolutionEnabled ?? false;
}
