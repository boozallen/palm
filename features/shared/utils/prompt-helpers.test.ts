import { 
  getPromptById, 
  insertRequestValuesIntoPrompt, 
  insertExampleInputIntoInstructionsInput, 
  generatePromptSlug, 
  generatePromptUrl ,
} from './prompt-helpers';

describe('getPromptById', () => {
  const prompts = [
    { id: '1', title: 'Prompt 1' },
    { id: '2', title: 'Prompt 2' },
    { id: '3', title: 'Prompt 3' },
  ];

  it('should return the correct prompt by id', () => {
    const result = getPromptById(prompts, '2');
    expect(result).toEqual({ id: '2', title: 'Prompt 2' });
  });

  it('should return undefined if the prompt is not found', () => {
    const result = getPromptById(prompts, '4');
    expect(result).toBeUndefined();
  });
});

describe('insertRequestValuesIntoPrompt', () => {
  it('should replace placeholders with request values', () => {
    const requestValues = { name: 'John', age: '30' };
    const prompt = 'Hello, {req.name}. You are {req.age} years old.';
    const expectedString = 'Hello, John. You are 30 years old.';
    const result = insertRequestValuesIntoPrompt(requestValues, prompt);
    expect(result).toBe(expectedString);
  });

  it('should handle missing request values gracefully', () => {
    const requestValues = { name: 'John' };
    const prompt = 'Hello, {req.name}. You are {req.age} years old.';
    const expectedString = 'Hello, John. You are {req.age} years old.';
    const result = insertRequestValuesIntoPrompt(requestValues, prompt);
    expect(result).toBe(expectedString);
  });
});

describe('insertExampleInputIntoInstructionsInput', () => {
  it('should return the full prompt with inline variables replaced by example input', () => {
    const prompt = 'Persona: You are an experienced software engineer. Write code based on the user\'s input.';
    const example = 'Write a short Python function to add two integers.';
    const expectedString = 'Persona: You are an experienced software engineer. Write code based on the user\'s input.\n\nWrite a short Python function to add two integers.';
    const result = insertExampleInputIntoInstructionsInput(example, prompt);
    expect(result).toBe(expectedString);
  });
});

describe('generatePromptSlug', () => {
  it('should generate a slug from a prompt title', () => {
    const promptTitle = 'This is a Test Title!';
    const expectedSlug = 'this-is-a-test-title';
    const result = generatePromptSlug(promptTitle);
    expect(result).toBe(expectedSlug);
  });

  it('should correctly encode special characters contained in the title', () => {
    const promptTitle = 'Special & Characters % Test';
    const expectedSlug = 'special-and-characters-percent-test';
    const result = generatePromptSlug(promptTitle);
    expect(result).toBe(expectedSlug);
  });
});

describe('generatePromptUrl', () => {
  it('should return a URL with encoded title and id', () => {
    const promptTitle = '<HTML> Accessibility Check';
    const promptId = '732b7ca3-e307-4b8d-be61-5e64624a9ab0';
    const expectedUrl = '/library/lesshtmlgreater-accessibility-check/732b7ca3-e307-4b8d-be61-5e64624a9ab0';
    const result = generatePromptUrl(promptTitle, promptId);
    expect(result).toBe(expectedUrl);
  });

  it('should handle special characters in a weird title', () => {
    const promptTitle = '&@!%3#  here is a weird title //<.-+;:[]}{';
    const promptId = '27badcf5-7446-4cbd-a875-f98e0779a8da';
    const expectedUrl = '/library/andpercent3-here-is-a-weird-title-less/27badcf5-7446-4cbd-a875-f98e0779a8da';
    const result = generatePromptUrl(promptTitle, promptId);
    expect(result).toBe(expectedUrl);
  });

  it('should handle alt code symbols', () => {
    const promptTitle = 'alt code symbols ☺☻♥♦♣♠•○►♫';
    const promptId = 'ce7d62f0-384c-40cd-8bd6-ff862cde5e8d';
    const expectedUrl = '/library/alt-code-symbols-love/ce7d62f0-384c-40cd-8bd6-ff862cde5e8d';
    const result = generatePromptUrl(promptTitle, promptId);
    expect(result).toBe(expectedUrl);
  });

  it('should handle multiple consecutive special characters in a title', () => {
    const promptTitle = '& here is a weird title & some backslashes ////';
    const promptId = '27badcf5-7446-4cbd-a875-f98e0779a8da';
    const expectedUrl = '/library/and-here-is-a-weird-title-and-some-backslashes/27badcf5-7446-4cbd-a875-f98e0779a8da';
    const result = generatePromptUrl(promptTitle, promptId);
    expect(result).toBe(expectedUrl);
  });

  it('should handle titles starting or ending with special characters or spaces', () => {
    const promptTitle = '   @@@ here is a weird title ###   ';
    const promptId = '27badcf5-7446-4cbd-a875-f98e0779a8da';
    const expectedUrl = '/library/here-is-a-weird-title/27badcf5-7446-4cbd-a875-f98e0779a8da';
    const result = generatePromptUrl(promptTitle, promptId);
    expect(result).toBe(expectedUrl);
  });
});
