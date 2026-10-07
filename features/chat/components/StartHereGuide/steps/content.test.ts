import { STEP_ORDER, STEP_COUNT, STEP_CONTENT, MOCK } from './content';

describe('start-here content', () => {
  it('defines four steps in order', () => {
    expect(STEP_COUNT).toBe(4);
    expect(STEP_ORDER).toEqual(['model', 'upload', 'ask', 'answer']);
  });

  it('has a title and caption for every step', () => {
    STEP_ORDER.forEach((id) => {
      expect(STEP_CONTENT[id].title.length).toBeGreaterThan(0);
      expect(STEP_CONTENT[id].caption.length).toBeGreaterThan(0);
    });
  });

  it('provides generic mock data', () => {
    expect(MOCK.modelOptions.length).toBeGreaterThanOrEqual(2);
    expect(MOCK.answerLines.length).toBeGreaterThan(0);
    expect(MOCK.fileName).toContain('.');
    expect(MOCK.artifactName).toContain('.');
  });
});
