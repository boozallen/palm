import { AIFactory } from '@/features/ai-provider';
import { AiSettings } from '@/types';
import { Prompt, promptTagSchema } from '@/features/shared/types';
import logger from '@/server/logger';
import getMostCommonPromptTags from '@/features/shared/dal/getMostCommonPromptTags';
import generatePromptTagSuggestions from '@/features/shared/system-ai/generatePromptTagSuggestions';

jest.mock('@/features/ai-provider');
jest.mock('@/features/shared/dal/getMostCommonPromptTags');

describe('generatePromptTagSuggestions', () => {

  const mockBuildSystemSource = jest.fn();
  const mockCompletion = jest.fn();

  const mockAIFactory = {
    buildSystemSource: mockBuildSystemSource,
  } as unknown as AIFactory;
  const mockSystemAi = {
    source: {
      completion: mockCompletion,
    },
    model: {
      externalId: 'default-system-model',
    },
  };
  const mockAiSettings: AiSettings = {
    model: mockSystemAi.model.externalId,
    randomness: 0.6,
    repetitiveness: 0.4,
  };

  const mockPrompt: Partial<Prompt> = {
    title: 'prompt-title',
    summary: 'prompt-summary',
    description: 'prompt-description',
    instructions: 'prompt-instructions',
    example: 'prompt-example',
    // tags: ['tag-one', 'tag-two', 'tag-three'],
    // config: {
    //   model: 'test-model',
    //   randomness: 0.5,
    //   repetitiveness: 0.5,
    // },
  };
  const mockMostCommonPromptTags = ['coding', 'document-analysis', 'content-generation'];

  const promptTagMaxLength = promptTagSchema._def.schema._def.schema._def.checks.find(
    (check): check is { kind: 'max'; value: number } => check.kind === 'max'
  )?.value;

  const generatePromptTagsInstructions = `
**Persona:**
Your expertise lies in understanding the nuances of diverse topics and generating distinct, non-overlapping tags that accurately represent the context of given content.

**Instructions:**
1. Read the provided Input Prompt carefully to understand its context and main themes.
2. Refer to this list of commonly used tags to grasp the ideal format and tone:
${mockMostCommonPromptTags}
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
${JSON.stringify(mockPrompt)}
`;

  const functionErrorMessage = 'Error generating prompt tag suggestions';

  let mockAiResponse = { text: '' };

  beforeEach(() => {
    jest.clearAllMocks();

    (getMostCommonPromptTags as jest.Mock).mockResolvedValue(mockMostCommonPromptTags);
    mockBuildSystemSource.mockResolvedValue(mockSystemAi);
  });

  afterEach(() => {
    expect(getMostCommonPromptTags).toHaveBeenCalledWith();
  });

  describe('_Returns', () => {
    let mockExpectedPromptTags: string[];

    afterEach(async () => {
      mockCompletion.mockResolvedValueOnce(mockAiResponse);

      expect(await generatePromptTagSuggestions(
        mockAIFactory,
        { prompt: mockPrompt },
      )).toEqual({ tags: mockExpectedPromptTags });

      expect(mockAIFactory.buildSystemSource).toHaveBeenCalledWith();
      expect(mockSystemAi.source.completion).toHaveBeenCalledWith(
        generatePromptTagsInstructions,
        mockAiSettings,
      );

      expect(logger.error).not.toHaveBeenCalled();
    });

    it('returns AI generated prompt tag suggestions', async () => {
      mockAiResponse.text = '["code-analysis", "optimization", "content-generation"]';
      mockExpectedPromptTags = ['code-analysis', 'optimization', 'content-generation'];
    });

    it('does not include invalid length tags in the return', async () => {
      mockAiResponse.text = '["this-tag-is-over-the-max-length", " ", "content-generation"]';
      mockExpectedPromptTags = ['content-generation'];
    });

    it('transforms tags to the correct format', async () => {
      mockAiResponse.text = '["code - - analysis", "CODE  OPTIMIZATION", " code--generation "]';
      mockExpectedPromptTags = ['code-analysis', 'code-optimization', 'code-generation'];
    });

    it('returns an empty array if no valid tags', async () => {
      mockAiResponse.text = '["this-tag-is-over-the-max-length", " "]';
      mockExpectedPromptTags = [];
    });

    it('returns an empty array if the AI incorrectly formats response where JSON.parse fails', async () => {
      mockAiResponse.text = '!? Incorrect Format Of Gibberish From AI That Hallucinated ?!';
      mockExpectedPromptTags = [];
    });
  });

  describe('_Throws Error', () => {
    let mockError = new Error('Error');

    const expectRejected = async () => {
      await expect(generatePromptTagSuggestions(
        mockAIFactory,
        { prompt: mockPrompt },
      )).rejects.toThrow(functionErrorMessage);
    };

    afterEach(() => {
      expect(logger.error).toHaveBeenCalledWith(functionErrorMessage, mockError);
    });

    it('throws an error if getMostCommonPromptTags DAL fails', async () => {
      mockError.message = 'Failed to get most common prompt tags';
      (getMostCommonPromptTags as jest.Mock).mockRejectedValueOnce(mockError);

      await expectRejected();
      expect(mockAIFactory.buildSystemSource).not.toHaveBeenCalled();
      expect(mockSystemAi.source.completion).not.toHaveBeenCalled();
    });

    it('throws an error if ai.buildSystemSource fails', async () => {
      mockError.message = 'Failed to build system source.';
      mockBuildSystemSource.mockRejectedValueOnce(mockError);

      await expectRejected();
      expect(mockAIFactory.buildSystemSource).toHaveBeenCalled();
      expect(mockSystemAi.source.completion).not.toHaveBeenCalled();
    });

    it('throws an error if ai.source.completion fails', async () => {
      mockError.message = 'Failed to get a AI response';
      mockCompletion.mockRejectedValueOnce(mockError);

      await expectRejected();
      expect(mockAIFactory.buildSystemSource).toHaveBeenCalled();
      expect(mockSystemAi.source.completion).toHaveBeenCalled();
    });
  });

});
