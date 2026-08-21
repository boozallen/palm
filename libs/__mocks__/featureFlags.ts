type FeatureFlags = {
  __resetFeatures: () => void;
  __enableFeature: (feature: string) => void;
  __disableFeature: (feature: string) => void;
} & typeof import('../featureFlags');

const featureFlags = jest.createMockFromModule<FeatureFlags>('../featureFlags');

featureFlags.isFeatureOn = jest.fn((feature: string) => {
  return enabledFeatures.includes(feature);
});

const enabledFeatures: string[] = [];

featureFlags.__resetFeatures = () => {
  enabledFeatures.length = 0;
};

featureFlags.__enableFeature = (feature: string) => {
  enabledFeatures.push(feature);
};

featureFlags.__disableFeature = (feature: string) => {
  const index = enabledFeatures.indexOf(feature);
  if (index > -1) {
    enabledFeatures.splice(index, 1);
  }
};

module.exports = featureFlags;
