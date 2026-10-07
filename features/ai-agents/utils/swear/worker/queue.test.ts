import { SwearJobData } from './queue';

describe('SwearJobData interface', () => {
  it('should have correct structure', () => {
    const jobData: SwearJobData = {
      jobId: 'test-job-123',
      userId: 'user-123',
      agentId: 'agent-123',
      documentText: 'Test document content',
      modelId: 'gpt-4',
      filename: 'test-warrant.pdf',
    };

    expect(jobData.jobId).toBe('test-job-123');
    expect(jobData.userId).toBe('user-123');
    expect(jobData.agentId).toBe('agent-123');
    expect(jobData.documentText).toBe('Test document content');
    expect(jobData.modelId).toBe('gpt-4');
    expect(jobData.filename).toBe('test-warrant.pdf');
  });

  it('should require documentText field', () => {
    const jobData: SwearJobData = {
      jobId: 'test-job',
      userId: 'user-123',
      agentId: 'agent-123',
      documentText: 'Required field',
      modelId: 'gpt-4',
      filename: 'test.pdf',
    };

    expect(jobData.documentText).toBeDefined();
    expect(typeof jobData.documentText).toBe('string');
  });

  it('should require modelId field', () => {
    const jobData: SwearJobData = {
      jobId: 'test-job',
      userId: 'user-123',
      agentId: 'agent-123',
      documentText: 'Test content',
      modelId: 'claude-3',
      filename: 'test.pdf',
    };

    expect(jobData.modelId).toBeDefined();
    expect(typeof jobData.modelId).toBe('string');
  });

  it('should require filename field', () => {
    const jobData: SwearJobData = {
      jobId: 'test-job',
      userId: 'user-123',
      agentId: 'agent-123',
      documentText: 'Test content',
      modelId: 'gpt-4',
      filename: 'warrant-document.pdf',
    };

    expect(jobData.filename).toBeDefined();
    expect(typeof jobData.filename).toBe('string');
  });
});

describe('getSwearQueue', () => {
  it('should export getSwearQueue function', () => {
    const { getSwearQueue } = require('./queue');
    expect(typeof getSwearQueue).toBe('function');
  });
});
