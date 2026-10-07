import { filterModelsByProviderIds } from './filterAvailableModels';

describe('filterModelsByProviderIds', () => {
  const models = [
    { id: 'model-1', aiProviderId: 'provider-1' },
    { id: 'model-2', aiProviderId: 'provider-2' },
    { id: 'model-3', aiProviderId: 'provider-1' },
  ];

  it('returns every model unchanged when aiProviderIds is not provided', () => {
    expect(filterModelsByProviderIds(models)).toEqual(models);
  });

  it('narrows to only the models whose provider is in aiProviderIds', () => {
    expect(filterModelsByProviderIds(models, ['provider-1'])).toEqual([models[0], models[2]]);
  });

  it('returns an empty list when no model matches the given provider ids', () => {
    expect(filterModelsByProviderIds(models, ['provider-does-not-exist'])).toEqual([]);
  });
});
