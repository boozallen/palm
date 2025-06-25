
export default function addKbContentToMessage(message: string, kbResults: string): string {

  let updatedMessage =
    `User message: ${message}
  
  KnowledgeBase Results: ${kbResults}
  
  Rules:
  1. Only when the user's message references provided context, integrate that context into the response
  2. Supplement the context with additional information from the LLM to provide a detailed and comprehensive response. 
  3. Do not use citations in the response.
  `;

  return updatedMessage;
}
