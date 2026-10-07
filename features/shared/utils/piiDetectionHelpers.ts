import { DetectedPii } from '@/features/shared/types/pii';

function detectEmailAddresses(text: string): DetectedPii[] {
  const matches: DetectedPii[] = [];
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  let match;
  
  while ((match = emailRegex.exec(text)) !== null) {
    matches.push({
      content: match[0],
      startIndex: match.index,
    });
  }
  
  return matches;
}

export function detectPii(text: string): DetectedPii[] {
  const detectedPii: DetectedPii[] = [];
  const emailAddresses = detectEmailAddresses(text);
  
  detectedPii.push(...emailAddresses);
  
  return detectedPii;
}
