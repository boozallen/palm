const LUCENE_SPECIAL = /([+\-!(){}\[\]^"~*?:\\/]|&&|\|\|)/g;

export function luceneEscape(text: string): string {
  return text.replace(LUCENE_SPECIAL, '\\$1');
}

export function buildLuceneOrQuery(terms: string[]): string {
  const filtered = terms.map(t => t.trim()).filter(Boolean);
  if (filtered.length === 0) { return '*'; }
  return filtered
    .map(t => t.includes(' ') ? `"${luceneEscape(t)}"` : luceneEscape(t))
    .join(' OR ');
}
