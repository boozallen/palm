import addKbContentToMessage from '@/features/chat/knowledge-bases/addKbContentToMessage';

let mockMessage = 'What is the best color?';
let mockKbResults = 'The best color is clearly green. (Citation: Color Theory, Score: 0.85)\nIn many cultures, red symbolizes love, energy, and sometimes danger. (Citation: Color For Dummies, Score: 0.75)\n';

describe('addKbContentToMessage', () => {
  it('should correctly format the message with knowledge base results', () => {

    const expectedOutput = `User message: ${mockMessage}
  
  KnowledgeBase Results: ${mockKbResults}
  
  Rules:
  1. Only when the user's message references provided context, integrate that context into the response
  2. Supplement the context with additional information from the LLM to provide a detailed and comprehensive response. 
  3. Do not use citations in the response.
  `;

    expect(addKbContentToMessage(mockMessage, mockKbResults)).toEqual(expectedOutput);
  });
});
