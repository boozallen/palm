import '@testing-library/jest-dom';

// Workaround to avoid warnings in the console about element.ref was removed in React 19
// TODO Remove this when Mantine is updated 
// https://github.com/mantinedev/mantine/issues/7028
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('element.ref was removed in React 19')) {
    return;
  }
  originalError(...args);
};

// Mock the client-side audit-record hook: it needs a tRPC provider component
// tests don't set up, and has no bearing on the behavior under test.
//
// A jest.fn(), not a plain arrow, so tests can override it with
// `(useCreateClientSideAuditRecord as jest.Mock).mockReturnValue(...)`, which
// throws if the export isn't already a mock fn.
jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: jest.fn(() => ({ mutate: jest.fn() })),
}));

jest.mock('@azure/openai', () => ({
  OpenAIClient: jest.fn(),
}));

jest.mock('@azure/core-auth', () => ({
  AzureKeyCredential: jest.fn(),
}));

// Mock server config to provide default test values for feature flags and agent services
// Note: Individual test files can use jest.unmock('@/server/config') to test the real implementation
jest.mock('@/server/config', () => ({
  getConfig: jest.fn(() => ({
    featureFlags: {
      prefix: 'Feature_',
      getValue: jest.fn().mockReturnValue(false),
    },
    agentServices: {
      langgraphServiceUrl: 'http://localhost:8000',
      claudeServiceUrl: 'http://localhost:8001',
      internalApiKey: 'test-key',
    },
  })),
}));

// Mock ResizeObserver which is used by Mantine components
global.ResizeObserver = class ResizeObserver {
  constructor(callback) {
    this.callback = callback;
  }
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

// Polyfill AbortSignal.timeout for Jest environment
if (!AbortSignal.timeout) {
  AbortSignal.timeout = (ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), ms);
    return controller.signal;
  };
}
