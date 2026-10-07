import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';
import { Citation, ContextType } from '@/features/chat/types/message';

const mockMessage = 'What is the best color?';
const mockCitations: Citation[] = [
  {
    citation: 'This is a citation',
    sourceLabel: 'my-document.pdf',
    contextType: ContextType.DOCUMENT_LIBRARY,
    documentId: 'some-test-id',
  },
];

describe('addContextToMessage', () => {
  it('should correctly format the message with citations', () => {
    const result = addContextToMessage(mockMessage, mockCitations);

    expect(result).toContain('## User message:');
    expect(result).toContain(mockMessage);
    expect(result).toContain('## Additional Contextual Information:');
    expect(result).toContain('Content: This is a citation');
    expect(result).toContain('Citation: my-document.pdf');
    expect(result).toContain('## Rules:');
  });

  it('returns original message if citations is an empty array', () => {
    expect(addContextToMessage('The original message', [])).toEqual('The original message');
  });

  it('formats multiple citations correctly', () => {
    const multipleCitations: Citation[] = [
      {
        citation: 'First citation content',
        sourceLabel: 'doc1.pdf',
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: 'doc-1',
      },
      {
        citation: 'Second citation content',
        sourceLabel: 'doc2.pdf',
        contextType: ContextType.DOCUMENT_LIBRARY,
        documentId: 'doc-2',
      },
    ];

    const result = addContextToMessage(mockMessage, multipleCitations);

    expect(result).toContain('Content: First citation content');
    expect(result).toContain('Citation: doc1.pdf');
    expect(result).toContain('Content: Second citation content');
    expect(result).toContain('Citation: doc2.pdf');
  });

  it('includes rules about context integration', () => {
    const result = addContextToMessage(mockMessage, mockCitations);

    expect(result).toContain('Only when the user\'s message references provided context');
    expect(result).toContain('supplement the context with additional information');
    expect(result).toContain('Do not use citations in the response');
  });
});
