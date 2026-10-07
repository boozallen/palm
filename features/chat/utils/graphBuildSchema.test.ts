import { computeEffectiveSchemas } from './graphBuildSchema';

describe('computeEffectiveSchemas', () => {
  it('suggests the schema from each document type', () => {
    const effective = computeEffectiveSchemas(
      ['doc-gov', 'doc-recipe', 'doc-untriaged'],
      { 'doc-gov': 'SOO', 'doc-recipe': 'Recipe', 'doc-untriaged': null },
      {},
    );

    expect(effective).toEqual({
      'doc-gov': 'government-pursuit',
      'doc-recipe': 'general',
      'doc-untriaged': 'general',
    });
  });

  it('lets an explicit override win over the suggestion', () => {
    const effective = computeEffectiveSchemas(
      ['doc-gov', 'doc-recipe'],
      { 'doc-gov': 'SOO', 'doc-recipe': 'Recipe' },
      { 'doc-recipe': 'government-pursuit' },
    );

    expect(effective['doc-gov']).toBe('government-pursuit'); // from suggestion
    expect(effective['doc-recipe']).toBe('government-pursuit'); // from override
  });

  it('keys the result only by selected documentIds', () => {
    const effective = computeEffectiveSchemas(
      ['doc-1'],
      { 'doc-1': 'Recipe', 'doc-2': 'SOO' },
      { 'doc-2': 'general' },
    );

    expect(Object.keys(effective)).toEqual(['doc-1']);
  });

  it('auto-defaults a newly-selected document with no override', () => {
    const overrides = { 'doc-existing': 'government-pursuit' };

    const effective = computeEffectiveSchemas(
      ['doc-existing', 'doc-new'],
      { 'doc-existing': 'Recipe', 'doc-new': 'PWS' },
      overrides,
    );

    expect(effective['doc-existing']).toBe('government-pursuit'); // override retained
    expect(effective['doc-new']).toBe('government-pursuit'); // suggested from 'PWS'
  });
});
