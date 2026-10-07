const nextJest = require('next/jest');

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files in your test environment
  dir: './',
});

// Add any custom config to be passed to Jest
/** @type {import('jest').Config} */
const customJestConfig = {
  // Add more setup options before each test is run
  // setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // if using TypeScript with a baseUrl set to the root directory then you need the below for alias' to work
  moduleDirectories: ['node_modules', '<rootDir>/'],

  // Exclude nested repo directories from test discovery
  modulePathIgnorePatterns: [
    '<rootDir>/palm-oss-damaris/',
    '<rootDir>/palm-oss-christie-graph/',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/palm-oss-damaris/',
    '<rootDir>/palm-oss-christie-graph/',
    '<rootDir>/features/graph-database/__tests__/integration/', // Manual integration tests, not unit tests
  ],
  
  // Force module resolution to be consistent
  resolver: undefined,
  
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // If you're using [Module Path Aliases](https://nextjs.org/docs/advanced-features/module-path-aliases),
  // you will have to add the moduleNameMapper in order for jest to resolve your absolute paths.
  // The paths have to be matching with the paths option within the compilerOptions in the tsconfig.json
  // For example:

  moduleNameMapper: {
    'react-markdown': '<rootDir>/test/__mocks__/react-markdown.jsx',
    'markdown': '<rootDir>/test/__mocks__/Markdown.tsx',
    'mermaid': '<rootDir>/test/__mocks__/mermaid/mermaid.js',
    'rehype-raw': '<rootDir>/test/__mocks__/mermaid/rehype-raw.js',
    'unified': '<rootDir>/test/__mocks__/unified.js',
    'remark-parse': '<rootDir>/test/__mocks__/remark-parse.js',
    'remark-gfm': '<rootDir>/test/__mocks__/remark-gfm.js',
    'mdast-util-to-string': '<rootDir>/test/__mocks__/mdast-util-to-string.js',
    '^@/(.*)$': '<rootDir>/$1',
    '^ioredis$': '<rootDir>/__mocks__/ioredis.ts',
    '^tiktoken$': '<rootDir>/__mocks__/tiktoken.ts',
  },
  testEnvironment: 'jest-environment-jsdom',
};

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = async () => {
  const nextJestConfig = await createJestConfig(customJestConfig)();
  
  // Override the transformIgnorePatterns that Next.js set
  // Transform ESM modules to CommonJS for Jest
  nextJestConfig.transformIgnorePatterns = [
    '/node_modules/(?!(' +
      'nanoid|@aws-sdk|@smithy|uuid|msgpackr|bullmq|openai|exceljs|' +
      'unified|remark.*|mdast.*|micromark.*|unist.*|' +
      'bail|is-plain-obj|trough|vfile.*|' +
      'decode-named-character-reference|character-entities|' +
      'ccount|escape-string-regexp|markdown-table|devlop|' +
      'longest-streak|zwitch|property-information|' +
      'hast-util.*|web-namespaces|' +
      'comma-separated-tokens|space-separated-tokens|trim-lines' +
    '))',
  ];
  
  return nextJestConfig;
};
