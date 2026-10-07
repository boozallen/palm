import type {
  PromptMatrixData,
  PromptMatrixQuestion,
} from '@/features/ai-agents/types/odram/promptMatrix';

type TeamResponse = {
  teamRating: string;
  teamRationale: string;
  teamMitigation: string;
};

/**
 * Assembles a complete question prompt from the Prompt Matrix sections
 * and the team's response data.
 *
 * Layout:
 *   Objective
 *   + Step 1 intro (evaluate risk rating)
 *   + Risk definitions (Low / Moderate / High)
 *   + Team's response (rating, rationale, mitigation)
 *   + Step 2 intro (evaluate mitigation)
 *   + Handbook guidance
 *   + Response guidelines
 */
export function assembleQuestionPrompt(
  question: PromptMatrixQuestion,
  matrix: PromptMatrixData,
  teamResponse: TeamResponse,
): string {
  const riskDefs = [
    `- Low: ${question.riskDefinitions.low}`,
    `- Moderate: ${question.riskDefinitions.moderate}`,
    `- High: ${question.riskDefinitions.high}`,
  ].join('\n');

  const teamSection = [
    `Team Rating: ${teamResponse.teamRating}`,
    `Team Rationale: ${teamResponse.teamRationale}`,
    `Team Mitigation Approach: ${teamResponse.teamMitigation}`,
  ].join('\n');

  const sections = [
    question.objective,
    question.extractionInstructions ? `Extraction Instructions:\n${question.extractionInstructions}` : '',
    matrix.step1Intro,
    `Risk Rating Definitions:\n${riskDefs}`,
    `--- TEAM RESPONSE ---\n${teamSection}`,
    matrix.step2Intro,
    question.handbookGuidance ? `Handbook Guidance:\n${question.handbookGuidance}` : '',
    matrix.responseGuidelines,
  ].filter(Boolean);

  return sections.join('\n\n');
}

/**
 * Returns the system prompt from the Prompt Matrix persona,
 * falling back to the hardcoded system prompt if the matrix has none.
 */
export function getSystemPrompt(
  matrix: PromptMatrixData,
  fallback: string,
): string {
  return matrix.persona.trim() || fallback;
}
