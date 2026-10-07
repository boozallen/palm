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
    expect(result[0].startPosition).toBe(0);
    expect(result[0].endPosition).toBe(text.length);
  });

  it('creates multiple chunks for long text', async () => {
    // Use natural sentence text (not numbered sentences which look like list items)
    const sentences = [
      'The quick brown fox jumps over the lazy dog.',
      'A journey of a thousand miles begins with a single step.',
      'To be or not to be, that is the question.',
      'All that glitters is not gold.',
      'Actions speak louder than words.',
      'The early bird catches the worm.',
      'A picture is worth a thousand words.',
      'When in Rome, do as the Romans do.',
      'The pen is mightier than the sword.',
      'Fortune favors the bold.',
    ];
    const text = sentences.join(' ');

    const result = await chunkText({ text, maxTokens: 30, overlapTokens: 0 });

    expect(result.length).toBeGreaterThan(1);

    result.forEach((chunk, index) => {
      expect(chunk.index).toBe(index);
      expect(chunk.tokenCount).toBeGreaterThan(0);
      expect(chunk.content.length).toBeGreaterThan(0);
      expect(chunk.startPosition).toBeGreaterThanOrEqual(0);
      expect(chunk.endPosition).toBeGreaterThan(chunk.startPosition);
      // endPosition can be slightly beyond text.length due to space concatenation
      expect(chunk.startPosition).toBeLessThan(text.length);
    });
  });

  it('uses default parameters', async () => {
    const text = 'Default test.';
    const result = await chunkText({ text });

    expect(result).toHaveLength(1);
    expect(result[0].tokenCount).toBeLessThanOrEqual(800);
    expect(result[0].startPosition).toBeDefined();
    expect(result[0].endPosition).toBeDefined();
  });

  it('handles overlap', async () => {
    const text = 'First sentence. Second sentence. Third sentence.';
    const result = await chunkText({ text, maxTokens: 10, overlapTokens: 5 });

    expect(result.length).toBeGreaterThan(0);
    result.forEach(chunk => {
      expect(chunk.content).toBeTruthy();
      expect(chunk.startPosition).toBeGreaterThanOrEqual(0);
      expect(chunk.endPosition).toBeGreaterThan(chunk.startPosition);
      // Positions should be reasonable relative to text length
      expect(chunk.startPosition).toBeLessThan(text.length);
    });
  });

  it('tracks positions accurately for citation mapping', async () => {
    const text = 'First sentence. Second sentence. Third sentence. Fourth sentence.';
    const result = await chunkText({ text, maxTokens: 50, overlapTokens: 0 });

    result.forEach(chunk => {
      // Verify that positions are valid
      expect(chunk.startPosition).toBeGreaterThanOrEqual(0);
      expect(chunk.endPosition).toBeGreaterThan(chunk.startPosition);
      expect(chunk.startPosition).toBeLessThan(text.length);

      // Verify that the chunk content can be mapped back to the original text
      // The startPosition should point to content that exists in the chunk
      const segmentFromStart = text.slice(chunk.startPosition);
      const firstWord = chunk.content.trim().split(' ')[0];
      expect(segmentFromStart.includes(firstWord)).toBe(true);
    });
  });

  it('does not split on decimal numbers', async () => {
    const text = 'The value is 42.1 percent. This exceeded the threshold of 3.5 units. The cost was $99.99 total.';
    const result = await chunkText({ text, maxTokens: 1000 });

    // Should be one chunk since it's under maxTokens
    expect(result).toHaveLength(1);

    // The content should contain the full decimal numbers, not split
    expect(result[0].content).toContain('42.1 percent');
    expect(result[0].content).toContain('3.5 units');
    expect(result[0].content).toContain('$99.99 total');
  });

  it('does not split on abbreviations', async () => {
    const text = 'I live in the U.S. now. Contact ABC Inc. for details. I have a Ph.D. in chemistry.';
    const result = await chunkText({ text, maxTokens: 1000 });

    expect(result).toHaveLength(1);
    expect(result[0].content).toContain('U.S. now');
    expect(result[0].content).toContain('Inc. for');
    expect(result[0].content).toContain('Ph.D. in');
  });
});
