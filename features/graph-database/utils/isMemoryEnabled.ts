import getSystemConfig from '@/features/shared/dal/getSystemConfig';

/**
 * Whether conversation memory (chat projection into the graph + hybrid
 * search) runs. Sourced from the admin SystemConfig toggle
 * (`memoryEnabled`) so it can be turned on/off from the Settings UI without
 * a redeploy.
 */
export async function isMemoryEnabled(): Promise<boolean> {
  const config = await getSystemConfig();
  return config.memoryEnabled ?? false;
}
