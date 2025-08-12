import { ContextType } from '@/server/trpc-context';
import sharedRoutes from '@/features/shared/routes';
import {
  features,
  isFeatureOn,
  __enableFeature,
  __resetFeatures,
} from '@/libs/featureFlags';

jest.mock('@/libs/featureFlags');

async function getFeatureFlag(feature: string) {
  const ctx = {} as unknown as ContextType;
  const caller = sharedRoutes.createCaller(ctx);

  return await caller.getFeatureFlag({ feature });
}

const testFeature = features.example;

describe('getFeatureFlag', () => {
  afterEach(() => {
    __resetFeatures();
  });

  it('should return true if the feature is enabled', async () => {
    __enableFeature(features.example);
    expect(await getFeatureFlag(testFeature)).toStrictEqual({
      isFeatureOn: true,
    });
    expect(isFeatureOn).toBeCalledWith(testFeature);
  });

  it('should return false if the feature is not enabled', async () => {
    expect(await getFeatureFlag(testFeature)).toStrictEqual({
      isFeatureOn: false,
    });
    expect(isFeatureOn).toBeCalledWith(testFeature);
  });
});
