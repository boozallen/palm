export const extractFollowUpQuestionsFromMessage = (input: string): { followUpQuestions: string[], cleanedText: string } => {
  const questions: string[] = [];
  let cleanedText = input;

  // Find all valid FOLLOWUP tags (with both opening and closing tags)
  const followupMatches = input.match(/<FOLLOWUP>(.*?)<\/FOLLOWUP>/g);

  if (followupMatches) {
    followupMatches.forEach(match => {
      const question = match.replace(/<FOLLOWUP>(.*?)<\/FOLLOWUP>/, '$1').trim();
      if (question.length > 0) {
        questions.push(question);
      }
      // Remove the matched tag from cleaned text
      cleanedText = cleanedText.replace(match, '');
    });
  }

  return { followUpQuestions: questions, cleanedText: cleanedText.trim() };
};
