import { KbProviderConfig, KbProviderType } from '@/features/shared/types';
import mergeKbProviderConfig from '@/features/kb-provider/sources/utils';

describe('mergeKbProviderConfig', () => {

  it('should merge configurations with an apiKey', () => {
    const existingConfig: KbProviderConfig = {
      apiEndpoint: 'https://api.example.com',
      apiKey: 'existing-api-key',
    };
    const inputConfig: KbProviderConfig = {
      apiEndpoint: 'https://api2.example.com',
      apiKey: 'input-api-key',
    };

    const result = mergeKbProviderConfig(existingConfig, inputConfig, KbProviderType.KbProviderPalm);

    expect(result).toEqual({
      apiEndpoint: 'https://api2.example.com',
      apiKey: 'input-api-key',
    });
  });

  it('should use the existing apiKey if the input does not have one', () => {
    const existingConfig: KbProviderConfig = {
      apiEndpoint: 'https://api.example.com',
      apiKey: 'existing-api-key',
    };
    const inputConfig: KbProviderConfig = {
      apiEndpoint: 'https://api2.example.com',
      apiKey: '',
    };

    const result = mergeKbProviderConfig(existingConfig, inputConfig, KbProviderType.KbProviderPalm);

    expect(result).toEqual({
      apiEndpoint: 'https://api2.example.com',
      apiKey: 'existing-api-key',
    });
  });

  it('should merge configurations with an accessKeyId', () => {
    const existingConfig: KbProviderConfig = {
      accessKeyId: 'existingAccessKeyId',
      secretAccessKey: 'existingSecretAccessKey',
      sessionToken: 'existingSessionToken',
      region: 'existingRegion',
    };
    const inputConfig: KbProviderConfig = {
      accessKeyId: 'inputAccessKeyId',
      secretAccessKey: 'inputSecretAccessKey',
      sessionToken: 'inputSessionToken',
      region: 'inputRegion',
    };

    const result = mergeKbProviderConfig(existingConfig, inputConfig, KbProviderType.KbProviderBedrock);

    expect(result).toEqual({
      accessKeyId: 'inputAccessKeyId',
      secretAccessKey: 'inputSecretAccessKey',
      sessionToken: 'inputSessionToken',
      region: 'inputRegion',
    });
  });

  it('should use the existing accessKeyId if the input does not have one', () => {
    const existingConfig: KbProviderConfig = {
      accessKeyId: 'existingAccessKeyId',
      secretAccessKey: 'existingSecretAccessKey',
      sessionToken: 'existingSessionToken',
      region: 'existingRegion',
    };
    const inputConfig: KbProviderConfig = {
      accessKeyId: '',
      secretAccessKey: 'inputSecretAccessKey',
      sessionToken: 'inputSessionToken',
      region: 'inputRegion',
    };

    const result = mergeKbProviderConfig(existingConfig, inputConfig, KbProviderType.KbProviderBedrock);

    expect(result).toEqual({
      accessKeyId: 'existingAccessKeyId',
      secretAccessKey: 'inputSecretAccessKey',
      sessionToken: 'inputSessionToken',
      region: 'inputRegion',
    });
  });

  it('should throw an error if the input config is invalid', () => {
    const existingConfig: KbProviderConfig = {
      accessKeyId: 'existingAccessKeyId',
      secretAccessKey: 'existingSecretAccessKey',
      sessionToken: 'existingSessionToken',
      region: 'existingRegion',
    };
    const inputConfig: KbProviderConfig = {
      apiEndpoint: 'https://api2.example.com',
      apiKey: 'input-api-key',
    };

    expect(() => mergeKbProviderConfig(existingConfig, inputConfig, -1 as KbProviderType)).toThrowError('Invalid input config');
  });
});
