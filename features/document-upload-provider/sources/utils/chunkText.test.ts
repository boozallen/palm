import { chunkText } from './chunkText';

describe('chunkText', () => {
  it('returns empty array for empty text', async () => {
    const result = await chunkText({ text: '' });
    expect(result).toEqual([]);
  });

  it('returns one chunk for short text', async () => {
    const text = 'This is a short sentence.';
    const result = await chunkText({ text, maxTokens: 1000 });
    
    expect(result).toHaveLength(1);
    expect(result[0].content).toContain('short sentence');
    expect(result[0].index).toBe(0);
    expect(result[0].tokenCount).toBeGreaterThan(0);
  });

  it('creates multiple chunks for long text', async () => {
    const sentences = Array.from({ length: 10 }, (_, i) => `Sentence ${i + 1}.`);
    const text = sentences.join(' ');
    
    const result = await chunkText({ text, maxTokens: 20, overlapTokens: 0 });
    
    expect(result.length).toBeGreaterThan(1);
    
    result.forEach((chunk, index) => {
      expect(chunk.index).toBe(index);
      expect(chunk.tokenCount).toBeGreaterThan(0);
      expect(chunk.content.length).toBeGreaterThan(0);
    });
  });

  it('uses default parameters', async () => {
    const text = 'Default test.';
    const result = await chunkText({ text });
    
    expect(result).toHaveLength(1);
    expect(result[0].tokenCount).toBeLessThanOrEqual(7000);
  });

  it('handles overlap', async () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const result = await chunkText({ text, maxTokens: 10, overlapTokens: 5 });
    
    expect(result.length).toBeGreaterThan(0);
    result.forEach(chunk => {
      expect(chunk.content).toBeTruthy();
    });
  });
});
