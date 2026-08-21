import { ParsedUserMessage } from '@/features/chat/types/message';

export const SELECTED_TEXT_DELIMITER = '<selected_text_follow_up>';

export const appendSelectedTextToUserMessage = (selectedText: string | null, userMessage: string) => {
  if (!selectedText || !selectedText.length) {
    return userMessage;
  }

  return `${SELECTED_TEXT_DELIMITER}${selectedText}${SELECTED_TEXT_DELIMITER}\n\n${userMessage}`.trim();
};

export const selectedTextSentParser = (content: string): ParsedUserMessage => {
  if (!content.includes(SELECTED_TEXT_DELIMITER)) {
    return { userMessage: content || '', selectedText: null };
  }

  const startIndex = content.indexOf(SELECTED_TEXT_DELIMITER) + SELECTED_TEXT_DELIMITER.length;
  const endIndex = content.indexOf(SELECTED_TEXT_DELIMITER, startIndex);

  const selectedText = content.slice(startIndex, endIndex);
  const cleanedContent = content.replace(`${SELECTED_TEXT_DELIMITER}${selectedText}${SELECTED_TEXT_DELIMITER}`, '').trim();

  return { userMessage: cleanedContent, selectedText };
};
