import {
  palmGraphSchema,
  type PalmGraph,
} from '@/features/graph-database/services/jsonIngest/types';

export function tryParsePalmGraph(text: string | null | undefined): PalmGraph | null {
  if (!text) {
    return null;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const parsed = palmGraphSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
