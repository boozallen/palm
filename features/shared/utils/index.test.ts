import * as utils from './index';

test('New exports are correctly exported', () => {
  expect(utils).toHaveProperty('useSafeExitModal');
  expect(utils).toHaveProperty('SafeExitContext');
});
