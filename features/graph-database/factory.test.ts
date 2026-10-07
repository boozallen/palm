import { GraphDatabaseFactory, getGraphDatabaseSource, _resetGraphDatabaseSourceForTesting } from '@/features/graph-database/factory';
import { GraphDatabaseProviderType } from '@/features/graph-database/sources/types';

// Mock the Neo4j source
const mockConnect = jest.fn().mockResolvedValue(undefined);
const mockDisconnect = jest.fn().mockResolvedValue(undefined);
const mockHealthCheck = jest.fn().mockResolvedValue(true);

jest.mock('@/features/graph-database/sources/neo4j', () => {
  return {
    Neo4jSource: jest.fn().mockImplementation((config) => {
      return {
        __mocked: true,
        config,
        connect: mockConnect,
        getProviderType: jest.fn().mockReturnValue(GraphDatabaseProviderType.NEO4J),
        healthCheck: mockHealthCheck,
        disconnect: mockDisconnect,
      };
    }),
  };
});

// Mock the config
jest.mock('@/server/config', () => ({
  getConfig: jest.fn().mockReturnValue({
    neo4j: {
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'test-password',
    },
  }),
}));

// Mock the logger
jest.mock('@/server/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
  default: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
  },
}));

const { Neo4jSource } = require('@/features/graph-database/sources/neo4j');

describe('GraphDatabaseFactory', () => {
  beforeEach(() => {
    _resetGraphDatabaseSourceForTesting();
    jest.clearAllMocks();
  });

  it('should create a factory instance', () => {
    const factory = new GraphDatabaseFactory();
    expect(factory).toBeInstanceOf(GraphDatabaseFactory);
  });

  it('should build a Neo4j source from config', async () => {
    const factory = new GraphDatabaseFactory();
    const result = await factory.buildSource();

    expect(Neo4jSource).toHaveBeenCalledWith({
      providerType: GraphDatabaseProviderType.NEO4J,
      uri: 'bolt://localhost:7687',
      username: 'neo4j',
      password: 'test-password',
      maxConnectionPoolSize: 50,
      connectionAcquisitionTimeout: 120000,
    });
    expect(result).toHaveProperty('source');
    expect(result).toHaveProperty('providerType');
    expect(result.providerType).toBe(GraphDatabaseProviderType.NEO4J);
    expect(result.source).toEqual(
      expect.objectContaining({ __mocked: true })
    );
  });

  it('should build and connect a source', async () => {
    const factory = new GraphDatabaseFactory();
    const result = await factory.buildAndConnect();

    expect(mockConnect).toHaveBeenCalled();
    expect(result.providerType).toBe(GraphDatabaseProviderType.NEO4J);
  });

  it('should support health check', async () => {
    const factory = new GraphDatabaseFactory();
    const result = await factory.buildSource();

    const isHealthy = await result.source.healthCheck();
    expect(isHealthy).toBe(true);
    expect(mockHealthCheck).toHaveBeenCalled();
  });
});

describe('getGraphDatabaseSource (singleton)', () => {
  beforeEach(() => {
    _resetGraphDatabaseSourceForTesting();
    jest.clearAllMocks();
  });

  it('should return the singleton instance', async () => {
    const source1 = await getGraphDatabaseSource();
    const source2 = await getGraphDatabaseSource();

    expect(source1).toBe(source2);
    expect(mockConnect).toHaveBeenCalledTimes(1);
  });

  it('should only create one Neo4jSource for multiple calls', async () => {
    await getGraphDatabaseSource();
    await getGraphDatabaseSource();
    await getGraphDatabaseSource();

    expect(Neo4jSource).toHaveBeenCalledTimes(1);
  });
});
