const COLUMN_LETTER = /^[A-Z]{1,3}$/i;

export function isColumnLetter(token: string): boolean {
  return COLUMN_LETTER.test(token);
}

export function formatColumnLetters(columns: string[]): string {
  return columns.join(', ');
}

// The one place a survey column's display label is built: 'C – Revenue', en dash, single spaces.
export function formatColumnLabel(letter: string, header: string): string {
  const name = header.trim().replace(/\s+/g, ' ');

  return name.length > 0 ? `${letter} – ${name}` : letter;
}
