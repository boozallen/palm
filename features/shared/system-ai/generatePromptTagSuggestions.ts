import { AIFactory } from '@/features/ai-provider';
import { AiSettings } from '@/types';
import { Prompt, promptTagSchema } from '@/features/shared/types';
import logger from '@/server/logger';
import getMostCommonPromptTags from '@/features/shared/dal/getMostCommonPromptTags';

export default async function generatePromptTagSuggestions(
  ai: AIFactory,
  input: {
    prompt: Partial<Prompt>,
  },
): Promise<{ tags: string[] }> {

  try {
    const mostCommonPromptTags = await getMostCommonPromptTags();

    const promptTagMaxLength = promptTagSchema._def.schema._def.schema._def.checks.find(
      (check): check is { kind: 'max'; value: number } => check.kind === 'max'
    )?.value;

    const generatePromptTagsInstructions = `
**Persona:**
Your expertise lies in understanding the nuances of diverse topics and generating distinct, non-overlapping tags that accurately represent the context of given content.

**Instructions:**
1. Read the provided Input Prompt carefully to understand its context and main themes.
2. Refer to this list of commonly used tags to grasp the ideal format and tone:
${mostCommonPromptTags}
3. When generating tags, adhere to these tag format rules:
 - Contain only lowercase alphanumeric characters.
 - Use a hyphen in place of a space between words.
 - Have a max length of ${promptTagMaxLength} (hyphens included).
4. Re-use the provided commonly used tags when they accurately signify the context of the prompt.
5. Generate between one to three tags to signify the prompt's context and theme. The optimal amount of tag suggestions is two.
6. If suggesting multiple tags, ensure that:
 - The tags do not share a substring. For example, "data-quality" and "data-cleaning" share the substring "data" and should not both be suggested.
 - The tags are diverse and do not cover the same topic or theme.
7. The output should strictly be an array (string) of your tag suggestions, for example:
["tag-one", "tag-two"]
8. Do not use markdown in your response. Do not respond with anything other than the array of tags.

**Input Prompt**
${JSON.stringify(input.prompt)}
`;

    const systemAi = await ai.buildSystemSource();

    const aiSettings: AiSettings = {
      model: systemAi.model.externalId,
      randomness: 0.6,
      repetitiveness: 0.4,
    };

    const aiResponse = await systemAi.source.completion(
      generatePromptTagsInstructions,
      aiSettings,
    );

    let validPromptTags: string[] = [];
    try {
      validPromptTags = (JSON.parse(aiResponse.text) as string[])
        .reduce<string[]>((validTags, promptTag) => {
          const safeParsedTag = promptTagSchema.safeParse(promptTag);
          if (safeParsedTag.success) {
            validTags.push(safeParsedTag.data);
          }
          return validTags;
        }, []);
    } catch (error) {
      // Do not throw error if AI responded with invalid format. Continue and return empty array
    }

    return {
      tags: validPromptTags,
    };
  } catch (error) {
    logger.error('Error generating prompt tag suggestions', error);
    throw new Error('Error generating prompt tag suggestions');
  }
}
