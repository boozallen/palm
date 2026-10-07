import { parseJsonObject } from '@/features/ai-agents/utils/shared/parseJsonObject';

describe('parseJsonObject', () => {
  it('parses a bare JSON object', () => {
    expect(parseJsonObject('{"a": 1}')).toEqual({ a: 1 });
  });

  it('parses a fenced JSON object', () => {
    expect(parseJsonObject('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it('parses an object surrounded by prose', () => {
    expect(parseJsonObject('Here it is: {"a": 1} hope that helps')).toEqual({ a: 1 });
  });

  it('skips a stray brace in the prose before the object', () => {
    expect(parseJsonObject('Use the {key: value} shape:\n{"a": 1}')).toEqual({ a: 1 });
  });

  it('ignores a stray closing brace after the object', () => {
    expect(parseJsonObject('{"a": 1}\nThat is all }')).toEqual({ a: 1 });
  });

  it('keeps braces and escaped quotes inside string values', () => {
    expect(parseJsonObject('{"a": "x } \\" { y", "b": {"c": 2}}')).toEqual({ a: 'x } " { y', b: { c: 2 } });
  });

  it('returns null when there is no object', () => {
    expect(parseJsonObject('no json here')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseJsonObject('{"a": }')).toBeNull();
  });

  it('returns null for an unterminated object', () => {
    expect(parseJsonObject('{"a": 1')).toBeNull();
  });

  it('returns null for an array with no object in it', () => {
    expect(parseJsonObject('[1, 2]')).toBeNull();
  });
});
