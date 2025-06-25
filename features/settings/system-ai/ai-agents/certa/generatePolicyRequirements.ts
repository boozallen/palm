import { AIFactory } from '@/features/ai-provider';
import { AiSettings } from '@/types';
import { logger } from '@/server/logger';

export default async function generatePolicyRequirements(
  ai: AIFactory,
  policyContent: string
): Promise<{ requirements: string }> {
  try {
    const generatePolicyRequirementsInstructions = `
    **Persona:** 
    You are a requirements extraction system that identifies compliance requirements from policy content.

    **Instructions:**
    Analyze the following policy content and extract all compliance requirements.
    Focus on statements containing 'must', 'shall', 'required', etc.
    Format your response as a plain text bulleted list with each item prefixed by '- '.
    Keep requirements atomic - don't combine multiple requirements.

    If no clear requirements are found in the content, respond with exactly ' No clear requirements found in the policy document' (without quotes).
      
    **Policy Content**:
    ${policyContent}
      
    **Output Format Example** (when requirements exist):
    - Must have privacy policy linked from footer
    - Must disclose data collection practices
    `;

    const systemAi = await ai.buildSystemSource();

    const aiSettings: AiSettings = {
      model: systemAi.model.externalId,
      randomness: 0.6,
      repetitiveness: 0.4,
    };

    const aiResponse = await systemAi.source.completion(
      generatePolicyRequirementsInstructions,
      aiSettings
    );

    let requirements = aiResponse.text.trim();

    if (requirements.includes('-')) {
      const lines = requirements.split('\n');
      const bulletedLines = lines.filter(line => line.trim().startsWith('-'));
  
      if (bulletedLines.length > 0) {
        requirements = bulletedLines.join('\n');
      }
    } 

return { requirements };

  } catch (error) {
    logger.error('Error generating requirements:', error);
    throw new Error('Error generating requirements');
  }
}
