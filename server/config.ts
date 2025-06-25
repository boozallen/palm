export function getConfig() {
  return {
    azureAd: {
      clientId: process.env['AZURE_AD_CLIENT_ID'] ?? '',
      clientSecret: process.env['AZURE_AD_CLIENT_SECRET'] ?? '',
      tenantId: process.env['AZURE_AD_TENANT_ID'] ?? '',
    },
    keycloak: {
      id: process.env['KEYCLOAK_ID'] ?? '',
      secret: process.env['KEYCLOAK_SECRET'] ?? '',
      issuer: process.env['KEYCLOAK_ISSUER'] ?? '',
    },
    redis: {
      host: process.env['REDIS_HOST'] ?? '',
      port: process.env['REDIS_PORT'] ?? '',
      password: process.env['REDIS_PASSWORD'] ?? '',
    },
    bedrock: {
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? '',
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? '',
      sessionToken: process.env['AWS_SESSION_TOKEN'] ?? '',
      region: process.env['AWS_REGION'] ?? '',
    },
    logLevel: process.env['LOG_LEVEL'],
    logFormat: process.env['LOG_FORMAT'],
    nodeEnv: process.env['NODE_ENV'],
    enableSecureCookies: process.env['ENABLE_SECURE_COOKIES']?.trim().toLowerCase() === 'true',
    featureFlags: {
      prefix: process.env['FEATURE_FLAG_PREFIX'] ?? 'Feature_',
      getValue: (featureName: string): boolean => {
        const envVarName = (process.env['FEATURE_FLAG_PREFIX'] ?? 'Feature_') + featureName;
        const envFeatureValue = process.env[envVarName] ?? '';
        return envFeatureValue.toLowerCase() === 'true';
      },
    },
    enabledNextAuthProviders: process.env['ENABLED_NEXTAUTH_PROVIDERS'] ?? '',
    nextAuthSecret: process.env['NEXTAUTH_SECRET'] as string,
    inheritedOAuthRolePath: process.env['INHERITED_OAUTH_ROLE_PATH'] ?? '',
  };
}
