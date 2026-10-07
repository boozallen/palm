export interface DatabaseQueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  executionTime: number;
}

export interface DatabaseQueryInput {
  query: string;
}

export interface DatabaseInfo {
  name: string;
  type: string;
  description: string;
  href: string;
}
