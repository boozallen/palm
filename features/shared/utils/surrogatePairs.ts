// JavaScript strings are UTF-16, so characters outside the Basic Multilingual Plane
// (emoji, some CJK) occupy two code units: a high surrogate followed by a low surrogate.
// Slicing between them leaves a lone surrogate that renders as a replacement character.

const isHighSurrogate = (code: number): boolean => code >= 0xd800 && code <= 0xdbff;
const isLowSurrogate = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

// Moves an index that lands on the second half of a pair back to the first half.
export function startOfCodePoint(text: string, index: number): number {
  return index > 0 && index < text.length && isLowSurrogate(text.charCodeAt(index))
    ? index - 1
    : index;
}

// Moves an index that would cut a pair after its first half to just past the pair.
export function endOfCodePoint(text: string, index: number): number {
  return index > 0 && index < text.length && isHighSurrogate(text.charCodeAt(index - 1))
    ? index + 1
    : index;
}
