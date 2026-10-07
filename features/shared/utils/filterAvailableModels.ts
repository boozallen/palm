export function filterModelsByProviderIds<T extends { aiProviderId: string }>(
  models: T[],
  aiProviderIds?: string[],
): T[] {
  if (!aiProviderIds) {
    return models;
  }
  return models.filter((model) => aiProviderIds.includes(model.aiProviderId));
}
