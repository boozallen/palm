import { getConfig } from './config';

describe('getConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns redis env vars when provided', () => {
    process.env['REDIS_HOST'] = 'custom-host';
    process.env['REDIS_PORT'] = '1234';
    process.env['REDIS_PASSWORD'] = 'secret';

    const config = getConfig();

    expect(config.redis).toEqual({
      host: 'custom-host',
      port: '1234',
      password: 'secret',
    });
  });

  it('returns documentUploadProvider-related env vars when provided', () => {
    process.env['AWS_ACCESS_KEY_ID'] = 'some-access-key-id';
    process.env['AWS_SECRET_ACCESS_KEY'] = 'some-secret-access-key';
    process.env['AWS_SESSION_TOKEN'] = 'some-session-token';
    process.env['AWS_REGION'] = 'us-east-1';

    process.env['USER_ID_SALT'] = 'some-salt';

    const config = getConfig();

    expect(config.documentUploadProvider).toEqual({
      aws: {
        accessKeyId: 'some-access-key-id',
        secretAccessKey: 'some-secret-access-key',
        sessionToken: 'some-session-token',
        region: 'us-east-1',
      },
      userIdSalt: 'some-salt',
    });
  });

  it('returns empty strings when env vars are not set', () => {
    process.env['REDIS_HOST'] = '';
    process.env['REDIS_PORT'] = '';
    process.env['REDIS_PASSWORD'] = '';

    const config = getConfig();

    expect(config.redis).toEqual({
      host: '',
      port: '',
      password: '',
    });
  });

  it('returns true when feature flag env var is set to true', () => {
    process.env['Feature_TEST_FEATURE'] = 'true';

    const config = getConfig();

    expect(config.featureFlags.getValue('TEST_FEATURE')).toBe(true);
  });

  it('returns true for any case variation of true', () => {
    process.env['Feature_TEST_FEATURE1'] = 'TRUE';
    process.env['Feature_TEST_FEATURE2'] = 'True';
    process.env['Feature_TEST_FEATURE3'] = 'tRuE';

    const config = getConfig();

    expect(config.featureFlags.getValue('TEST_FEATURE1')).toBe(true);
    expect(config.featureFlags.getValue('TEST_FEATURE2')).toBe(true);
    expect(config.featureFlags.getValue('TEST_FEATURE3')).toBe(true);
  });

  it('returns false when feature flag env var is not set to true', () => {
    process.env['Feature_TEST_FEATURE'] = 'false';

    const config = getConfig();

    expect(config.featureFlags.getValue('TEST_FEATURE')).toBe(false);
  });

  it('returns false when feature flag env var is empty', () => {
    process.env['Feature_TEST_FEATURE'] = '';

    const config = getConfig();

    expect(config.featureFlags.getValue('TEST_FEATURE')).toBe(false);
  });

  it('returns false when feature flag env var is not set', () => {
    delete process.env['Feature_TEST_FEATURE'];

    const config = getConfig();

    expect(config.featureFlags.getValue('TEST_FEATURE')).toBe(false);
  });
});
