import { extractFollowUpQuestionsFromMessage } from './followUpQuestionsHelpers';

describe('followUpQuestionsHelpers', () => {
  describe('extractFollowUpQuestionsFromMessage', () => {
    it('should extract single follow-up question correctly', () => {
      const input = 'Here is some text <FOLLOWUP>What is your favorite color?</FOLLOWUP> and more text.';
      const result = extractFollowUpQuestionsFromMessage(input);

      expect(result.followUpQuestions).toEqual(['What is your favorite color?']);
      expect(result.cleanedText).toBe('Here is some text  and more text.');
    });

    it('should extract multiple follow-up questions correctly', () => {
      const input = `Here is some text <FOLLOWUP>What is your favorite color?</FOLLOWUP>
        <FOLLOWUP>How old are you?</FOLLOWUP>
        <FOLLOWUP>Where do you live?</FOLLOWUP> and more text.`;
      const result = extractFollowUpQuestionsFromMessage(input);

      expect(result.followUpQuestions).toEqual([
        'What is your favorite color?',
        'How old are you?',
        'Where do you live?',
      ]);
      expect(result.cleanedText).toContain('Here is some text');
      expect(result.cleanedText).toContain('and more text.');
      expect(result.cleanedText).not.toContain('<FOLLOWUP>');
      expect(result.cleanedText).not.toContain('</FOLLOWUP>');
    });

    it('should handle empty follow-up tags', () => {
      const input = 'Here is some text <FOLLOWUP></FOLLOWUP> and more text.';
      const result = extractFollowUpQuestionsFromMessage(input);

      expect(result.followUpQuestions).toEqual([]);
      expect(result.cleanedText).toBe('Here is some text  and more text.');
    });

    it('should handle whitespace in follow-up tags', () => {
      const input = 'Here is some text <FOLLOWUP>  What is your name?  </FOLLOWUP> and more text.';
      const result = extractFollowUpQuestionsFromMessage(input);

      expect(result.followUpQuestions).toEqual(['What is your name?']);
      expect(result.cleanedText).toBe('Here is some text  and more text.');
    });

    it('should handle text with no follow-up questions', () => {
      const input = 'Here is some text with no follow-up questions.';
      const result = extractFollowUpQuestionsFromMessage(input);

      expect(result.followUpQuestions).toEqual([]);
      expect(result.cleanedText).toBe('Here is some text with no follow-up questions.');
    });

    it('should handle malformed tags gracefully', () => {
      const input = 'Here is some text <FOLLOWUP>Question without closing tag and more text.';
      const result = extractFollowUpQuestionsFromMessage(input);

      expect(result.followUpQuestions).toEqual([]);
      expect(result.cleanedText).toBe('Here is some text <FOLLOWUP>Question without closing tag and more text.');
    });

    it('should handle nested or complex content', () => {
      const input = `This is a response with code:
        \`\`\`javascript
        const x = 1;
        \`\`\`
        <FOLLOWUP>How does this code work?</FOLLOWUP>
        <FOLLOWUP>What is the output?</FOLLOWUP>
        End of response.`;
      const result = extractFollowUpQuestionsFromMessage(input);

      expect(result.followUpQuestions).toEqual([
        'How does this code work?',
        'What is the output?',
      ]);
      expect(result.cleanedText).toContain('const x = 1;');
      expect(result.cleanedText).toContain('End of response.');
    });
  });
});
