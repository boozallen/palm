import { features } from './features';

describe('features', () => {
  Object.keys(features).forEach((featureKey: string) => {
    it('key should equal to the value (feature\'s name)', () => {
      expect(featureKey).toBe(features[featureKey]);
    });
  });
});

