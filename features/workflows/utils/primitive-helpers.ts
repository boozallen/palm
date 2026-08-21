import { PrimitiveType } from '@/features/workflows/types/primitive';
import { getNodeDef } from '@/features/workflows/utils/node-registry';

export const getPrimitiveLabel = (type: PrimitiveType): string => {
  return getNodeDef(type).label;
};

/**
 * Strip markdown code fence markers from a string if present
 * If the content is wrapped in code fences, extract only the content between them
 */
export const stripMarkdownCodeFence = (text: string): string => {
  const trimmed = text.trim();

  // First check if it's already valid HTML (starts with <!DOCTYPE or <html)
  if (isCompleteHTMLDocument(trimmed)) {
    return trimmed;
  }

  // Try to extract HTML from between code fences using regex
  // This captures content between ```html (or just ```) and the closing ```
  const codeFencePattern = /^```(?:html)?\s*\n([\s\S]*?)\n```/i;
  const match = trimmed.match(codeFencePattern);

  if (match && match[1]) {
    // Return only the content between the fences
    return match[1].trim();
  }

  // If no code fence found, return as-is
  return trimmed;
};

/**
 * Check if a string is already a complete HTML document
 */
export const isCompleteHTMLDocument = (text: string): boolean => {
  const trimmed = text.trimStart().toLowerCase();
  return trimmed.startsWith('<!doctype html') || trimmed.startsWith('<html');
};
