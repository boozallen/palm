type Config = {
  azureAd: {
    clientId: string;
    clientSecret: string;
    tenantId: string;
  };
  keycloak: {
    id: string;
    secret: string;
    issuer: string;
  };
  redis: {
    host: string;
    port: string;
    password: string;
  };
  bedrock: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    region: string;
  };
  polly: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
    region: string;
  };
  documentUploadProvider: {
    aws: {
      accessKeyId: string;
      secretAccessKey: string;
      sessionToken: string;
      region: string;
    };
    userIdSalt: string;
  };
  wageData: {
    blsApiKey: string;
    dolUserId: string;
    dolApiKey: string;
    salaryComClientId: string;
    salaryComClientSecret: string;
    salaryComToken: string;
  };
  neo4j: {
    uri: string;
    username: string;
    password: string;
  };
  agentServices: {
    langgraphServiceUrl: string;
    claudeServiceUrl: string;
    doclingServiceUrl: string;
    repoServiceUrl: string;
    internalApiKey: string;
  };
  s3BucketName: string;
  logLevel: string | undefined;
  logFormat: string | undefined;
  nodeEnv: string | undefined;
  enableSecureCookies: boolean;
  featureFlags: {
    prefix: string;
    getValue: (featureName: string) => boolean;
  };
  enabledNextAuthProviders: string;
  nextAuthSecret: string;
  inheritedOAuthRolePath: string;
};

export function getConfig(): Config {
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
    polly: {
      accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? '',
      secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? '',
      sessionToken: process.env['AWS_SESSION_TOKEN'] ?? '',
      region: process.env['AWS_REGION'] ?? '',
    },
    documentUploadProvider: {
      aws: {
        accessKeyId: process.env['AWS_ACCESS_KEY_ID'] ?? '',
        secretAccessKey: process.env['AWS_SECRET_ACCESS_KEY'] ?? '',
        sessionToken: process.env['AWS_SESSION_TOKEN'] ?? '',
        region: process.env['AWS_REGION'] ?? '',
      },
      userIdSalt: process.env['USER_ID_SALT'] ?? '',
    },
    wageData: {
      blsApiKey: process.env['BLS_API_KEY'] ?? '',
      dolUserId: process.env['CAREER_ONE_STOP_USER_ID'] ?? '',
      dolApiKey: process.env['CAREER_ONE_STOP_API_KEY'] ?? '',
      salaryComClientId: process.env['SALARY_COM_CLIENT_ID'] ?? '',
      salaryComClientSecret: process.env['SALARY_COM_CLIENT_SECRET'] ?? '',
      salaryComToken: process.env['SALARY_COM_TOKEN'] ?? '',
    },
    neo4j: {
      uri: process.env['NEO4J_URI'] ?? '',
      username: process.env['NEO4J_USERNAME'] ?? '',
      password: process.env['NEO4J_PASSWORD'] ?? '',
    },
    agentServices: {
      langgraphServiceUrl: process.env['LANGGRAPH_SERVICE_URL'] ?? 'http://langgraph-service:8000',
      claudeServiceUrl: process.env['CLAUDE_SERVICE_URL'] ?? 'http://claude-service:8000',
      doclingServiceUrl: process.env['DOCLING_SERVICE_URL'] ?? 'http://docling-service:8000',
      repoServiceUrl: process.env['SKILL_REPO_SERVICE_URL'] ?? 'http://repo-service:8002',
      internalApiKey: process.env['INTERNAL_API_KEY'] ?? '',
    },
    s3BucketName: process.env['AWS_S3_BUCKET_NAME'] ?? '',
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
