import { isEditableArtifact, usesRichTextEditor } from '@/features/shared/types/document';

describe('isEditableArtifact', () => {
  it('returns true for text-based artifacts with content', () => {
    expect(isEditableArtifact('.md', '# Hello')).toBe(true);
    expect(isEditableArtifact('.txt', 'plain text')).toBe(true);
    expect(isEditableArtifact('.json', '{}')).toBe(true);
    expect(isEditableArtifact('.html', '<p>hi</p>')).toBe(true);
    expect(isEditableArtifact('.csv', 'a,b')).toBe(true);
  });

  it('returns false for binary artifacts even with content', () => {
    expect(isEditableArtifact('.docx', 'anything')).toBe(false);
    expect(isEditableArtifact('.xlsx', 'anything')).toBe(false);
    expect(isEditableArtifact('.pdf', 'anything')).toBe(false);
    expect(isEditableArtifact('.mp4', 'anything')).toBe(false);
  });

  it('is case-insensitive for the binary check', () => {
    expect(isEditableArtifact('.DOCX', 'anything')).toBe(false);
  });

  it('returns false for empty content', () => {
    expect(isEditableArtifact('.md', '')).toBe(false);
  });
});

describe('usesRichTextEditor', () => {
  it('returns true for prose file types', () => {
    expect(usesRichTextEditor('.md')).toBe(true);
    expect(usesRichTextEditor('.txt')).toBe(true);
    expect(usesRichTextEditor('.MD')).toBe(true);
  });

  it('returns false for code and other text types', () => {
    expect(usesRichTextEditor('.json')).toBe(false);
    expect(usesRichTextEditor('.html')).toBe(false);
    expect(usesRichTextEditor('.csv')).toBe(false);
    expect(usesRichTextEditor('.mmd')).toBe(false);
  });
});
