import { TextChunker } from '@/features/ai-agents/utils/textChunker';
import { Document } from '@/features/ai-agents/types/certa/webPolicyCompliance';

jest.mock('nanoid', () => ({
  nanoid: jest.fn(() => 'test-nanoid'),
}));

jest.mock('cheerio', () => ({
  load: jest.fn(() => {
    const $ = () => {
      return {
        text: () => 'Mock text content',
        each: () => {},
        remove: () => {},
        attr: () => '',
        replaceWith: () => {},
      };
    };
    $.text = () => 'Mock text content';
    $.each = () => {};
    $.remove = () => {};
    return $;
  }),
}));

describe('TextChunker', () => {
  let textChunker: TextChunker;

  beforeEach(() => {
    jest.clearAllMocks();
    textChunker = new TextChunker(512, 150);
  });

  describe('Basic functionality', () => {
    it('should process a document into at least one chunk', () => {
      const doc: Document = {
        id: 'test-doc',
        text: '<html><body>Test content</body></html>',
        metadata: { url: 'https://example.com' },
      };

      const chunks = textChunker.processDocument(doc);

      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0].id).toBeDefined();
      expect(chunks[0].text).toBeDefined();
      expect(chunks[0].metadata).toBeDefined();
    });

    it('should generate document ID if none provided', () => {
      const doc: Document = {
        text: '<html><body>Test content</body></html>',
        metadata: {},
      };

      const chunks = textChunker.processDocument(doc);

      expect(chunks[0].metadata?.doc_id).toContain('test-nanoid');
    });

    it('should preserve document URL in metadata', () => {
      const doc: Document = {
        id: 'test-doc',
        text: '<html><body>Test content</body></html>',
        metadata: { url: 'https://example.com/test' },
      };

      const chunks = textChunker.processDocument(doc);

      expect(chunks[0].metadata?.url).toBe('https://example.com/test');
    });
  });

  describe('Chunk metadata', () => {
    it('should assign chunk indices and total count', () => {
      const smallChunker = new TextChunker(20, 5);
      const doc: Document = {
        id: 'test-doc',
        text: '<html><body>This text should be long enough to split into multiple chunks</body></html>',
        metadata: {},
      };

      const chunks = smallChunker.processDocument(doc);

      if (chunks.length > 1) {
        expect(chunks[0].metadata?.chunk_index).toBe(0);
        expect(chunks[0].metadata?.total_chunks).toBe(chunks.length);

        const lastIndex = chunks.length - 1;
        expect(chunks[lastIndex].metadata?.chunk_index).toBe(lastIndex);
      } else {
        expect(chunks[0].metadata?.chunk_index).toBe(0);
      }
    });

    it('should assign semantic sources to chunks', () => {
      const doc: Document = {
        id: 'test-doc',
        text: '<html><body>Test content</body></html>',
        metadata: {},
      };

      const chunks = textChunker.processDocument(doc);

      expect(chunks[0].metadata?.semanticSource).toBeDefined();
    });
  });
});
