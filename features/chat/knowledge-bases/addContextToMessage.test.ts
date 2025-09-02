import addContextToMessage from '@/features/chat/knowledge-bases/addContextToMessage';
import { Citation, ContextType } from '@/features/chat/types/message';

let mockMessage = 'What is the best color?';
let mockCitations: Citation[] = [
  {
    citation: 'This is a citation',
    sourceLabel: 'my-document.pdf',
    contextType: ContextType.DOCUMENT_LIBRARY,
    documentId: 'some-test-id',
  },
];

describe('addKbContentToMessage', () => {
  it('should correctly format the message with knowledge base results', () => {

    const expectedOutput = `
  ## User message:
  ${mockMessage}

  ## Additional Contextual Information:
  [
{
Content: This is a citation
Citation: my-document.pdf
}
]

  ## Rules:
  1. Only when the user's message references provided context, integrate that context into the response.
  2. Supplement the context with additional information from the LLM to provide a detailed and comprehensive response.
  3. Do not use citations in the response.
  `;

    expect(addContextToMessage(mockMessage, mockCitations)).toEqual(expectedOutput);
  });

  it('returns original message if citations is an empty array', () => {
    expect(addContextToMessage('The original message', [])).toEqual('The original message');
  });
});
