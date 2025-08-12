// This file places all the Feature Flag implementation into one place.

/**
 * TESTING INSTRUCTIONS
 *
 * 1. If you're testing code which calls `isFeatureOn` then you will need to add this line after the imports:
 * ```
 * jest.mock('@/libs/featureFlags');
 * ```
 *
 * 2. If you're going to test any code and will be testing code hidden behind a feature flag, you will need
 * to import a few helpers:
 * ```
 * import { features, __disableFeature, __enableFeature, __resetFeatures } from '@/libs/featureFlags';
 * ```
 *
 * The functions prefixed with `__` are for testing purposes only. They will not be available outside of tests.
 *
 * In either beforeAll, beforeEach, afterAll, or afterEach, you will need to call `__resetFeatures()` to ensure
 * that the feature flags are reset between tests.
 *
 * Inside of your tests you can call `__enableFeature(feature)` and `__disableFeature(feature)` to enable or
 * disable features for the duration of the test.
 *
 * If you want to verify that `isFeatureOn` was called a number of times, or with a specific feature, you can
 * also import it with the above import statement then use either of the following:
 * ```
 * expect(isFeatureOn).toBeCalledTimes(1);
 * expect(isFeatureOn).toBeCalledWith(features.example);
 *
 * No additional steps will be required to test code that calls `isFeatureOn` directly.
 */
import { getConfig } from '@/server/config';

const config = getConfig();

export const featurePrefix = config.featureFlags.prefix;

export const features = {
  example: 'example', //do not remove example.  It is used for testing.

  // Add new features here
  Profile: 'Profile',
  PALM_KB: 'PALM_KB',
};

const featureKeys = Object.keys(features);

// isFeatureOn is a utility function that checks if a feature is enabled
export function isFeatureOn(feature: string): boolean {
  if (!featureKeys.includes(feature)) {
    return false;
  }
  return config.featureFlags.getValue(feature);
}
