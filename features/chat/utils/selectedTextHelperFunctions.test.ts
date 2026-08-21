import {
  appendSelectedTextToUserMessage,
  SELECTED_TEXT_DELIMITER,
  selectedTextSentParser,
} from './selectedTextHelperFunctions';

describe('selectedTextSentParser', () => {
  describe('valid input cases', () => {
    it('should parse content with selected text correctly', () => {
      const input = `${SELECTED_TEXT_DELIMITER}Hello World${SELECTED_TEXT_DELIMITER} How can I help you today?`;
      const result = selectedTextSentParser(input);

      expect(result).toEqual({
        userMessage: 'How can I help you today?',
        selectedText: 'Hello World',
      });
    });

    it('should handle content with extra whitespace', () => {
      const input = `${SELECTED_TEXT_DELIMITER}Selected text${SELECTED_TEXT_DELIMITER}   Main content with spaces   `;
      const result = selectedTextSentParser(input);

      expect(result).toEqual({
        userMessage: 'Main content with spaces',
        selectedText: 'Selected text',
      });
    });

    it('should handle empty selected text between markers', () => {
      const input = `${SELECTED_TEXT_DELIMITER}${SELECTED_TEXT_DELIMITER} Main content`;
      const result = selectedTextSentParser(input);

      expect(result).toEqual({
        userMessage: 'Main content',
        selectedText: '',
      });
    });

    it('should handle special characters in selected text', () => {
      const input = `${SELECTED_TEXT_DELIMITER}Text with "quotes" & symbols!${SELECTED_TEXT_DELIMITER} Regular content`;
      const result = selectedTextSentParser(input);

      expect(result).toEqual({
        userMessage: 'Regular content',
        selectedText: 'Text with "quotes" & symbols!',
      });
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle content without markers', () => {
      const input = 'Just regular content without any markers';
      const result = selectedTextSentParser(input);

      expect(result).toEqual({
        userMessage: 'Just regular content without any markers',
        selectedText: null,
      });
    });

    it('should handle empty string input', () => {
      const result = selectedTextSentParser('');

      expect(result).toEqual({
        userMessage: '',
        selectedText: null,
      });
    });

    it('should handle content with only markers and no additional content', () => {
      const input = `${SELECTED_TEXT_DELIMITER}Selected only${SELECTED_TEXT_DELIMITER}`;
      const result = selectedTextSentParser(input);

      expect(result).toEqual({
        userMessage: '',
        selectedText: 'Selected only',
      });
    });
  });
});

describe('appendSelectedTextToUserMessage', () => {
  it('does not append selected text if it is null', () => {
    const selectedText = null;
    const userMessage = 'Hello, world!';

    const res = appendSelectedTextToUserMessage(selectedText, userMessage);

    expect(res).toEqual(userMessage);
  });

  it('does not append selected text if it is empty string', () => {
    const selectedText = '';
    const userMessage = 'Hello, world!';

    const res = appendSelectedTextToUserMessage(selectedText, userMessage);

    expect(res).toEqual(userMessage);
  });

  it('appends valid selected text with demarcators', () => {
    const selectedText = 'Howdy!';
    const userMessage = 'Hello, world!';

    const res = appendSelectedTextToUserMessage(selectedText, userMessage);

    expect(res.includes(SELECTED_TEXT_DELIMITER)).toBe(true);
    expect(res.includes(selectedText)).toBe(true);
    expect(res.includes(SELECTED_TEXT_DELIMITER)).toBe(true);
    expect(res.includes(userMessage)).toBe(true);
  });
});
