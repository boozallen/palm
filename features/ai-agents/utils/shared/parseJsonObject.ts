// Index of the `}` that closes the `{` at `start`, ignoring braces inside JSON strings.
function findClosingBrace(text: string, start: number): number {
  let depth = 0;
  let inString = false;
  for (let i = start; i < text.length; i++) {
    const char = text[i];
    if (inString) {
      if (char === '\\') {
        i++;
      } else if (char === '"') {
        inString = false;
      }
    } else if (char === '"') {
      inString = true;
    } else if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        return i;
      }
    }
  }
  return -1;
}

// Returns the first JSON object embedded in a model response, tolerating code fences and surrounding prose.
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const stripped = text.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();

  for (let start = stripped.indexOf('{'); start !== -1; start = stripped.indexOf('{', start + 1)) {
    const end = findClosingBrace(stripped, start);
    if (end === -1) {
      continue;
    }
    try {
      const parsed: unknown = JSON.parse(stripped.slice(start, end + 1));
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Not valid JSON from this brace; try the next one.
    }
  }

  return null;
}
