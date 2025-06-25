import '@testing-library/jest-dom';
import 'openai/shims/node';
//
// // A workarround (or solution?) is to polyfill TextEncoder and TextDecoder in a setupFilesAfterEnv script:
// import { TextEncoder, TextDecoder } from 'util';
// global.TextEncoder = TextEncoder;
// global.TextDecoder = TextDecoder;
//

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

jest.mock('@azure/openai', () => ({
  OpenAIClient: jest.fn(),
}));

jest.mock('@azure/core-auth', () => ({
  AzureKeyCredential: jest.fn(),
}));
