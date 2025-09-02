import { Queue } from 'bullmq';
import { getRedisClient } from '@/server/storage/redisConnection';
import { getResearchQueue } from './researchQueue';

jest.mock('bullmq', () => ({
  Queue: jest.fn(),
}));

jest.mock('@/server/storage/redisConnection', () => ({
  getRedisClient: jest.fn(),
}));

const mockQueue = Queue as jest.MockedClass<typeof Queue>;
const mockGetRedisClient = getRedisClient as jest.Mock;

describe('getResearchQueue', () => {
  it('should return a queue when Redis connection is available', () => {
    const mockConnection = { host: 'localhost', port: 6379 };
    const mockQueueInstance = { add: jest.fn() };
    
    mockGetRedisClient.mockReturnValue(mockConnection);
    mockQueue.mockReturnValue(mockQueueInstance as any);
    
    const result = getResearchQueue();
    
    expect(result).toBeTruthy();
    expect(result).toEqual(mockQueueInstance);
  });
});
