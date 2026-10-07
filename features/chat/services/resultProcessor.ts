import { Text2CypherResult } from '@/features/graph-database/services/text2Cypher';
import { logger } from '@/server/logger';

const TRUNCATION_THRESHOLD = 200; // Rows above this get stats+sample instead of full data
const SAMPLE_SIZE = 10; // Number of sample rows to show when truncated

export interface ProcessedResult {
  bypassLLM: boolean;
  context?: string;
  artifactContent?: string; // Full table markdown for artifact
  artifactLabel?: string; // Label for artifact button
}

interface ColumnSpec {
  columnKeys: string[];
  headers: string[];
  tableHeader: string;
  separator: string;
}

/**
 * Process text2cypher results for LLM summarization with artifact.
 * - Enumeration: LLM gets context (full or truncated), artifact gets full table
 * - Other types: LLM gets context, no artifact
 */
export function processText2CypherResult(result: Text2CypherResult): ProcessedResult {
  // Error or empty - let LLM handle gracefully
  if (result.error || result.rowCount === 0) {
    return {
      bypassLLM: false,
      context: result.error
        ? `Graph query failed: ${result.error}`
        : 'No results found for this query.',
    };
  }

  // Non-enumeration - format as context for LLM, no artifact
  if (result.queryType !== 'enumeration') {
    return {
      bypassLLM: false,
      context: formatAsContext(result),
    };
  }

  // Enumeration - create artifact with full table, LLM gets context
  logger.info('[RESULT-PROCESSOR] Enumeration detected, creating artifact', {
    rowCount: result.rowCount,
    query: result.query,
    truncated: result.rowCount > TRUNCATION_THRESHOLD,
  });

  const columnSpec = generateColumnSpec(result);
  const artifactContent = buildFullTable(result, columnSpec);
  const context = buildLLMContext(result, columnSpec);

  logger.info('[RESULT-PROCESSOR] Enumeration processed', {
    rowCount: result.rowCount,
    artifactLength: artifactContent.length,
    contextLength: context.length,
  });

  return {
    bypassLLM: false,
    context,
    artifactContent,
    artifactLabel: `Graph Results (${result.rowCount} rows)`,
  };
}

/**
 * Generate column specification from result data.
 */
function generateColumnSpec(result: Text2CypherResult): ColumnSpec {
  const sampleRow = result.results[0];
  const columnKeys = Object.keys(sampleRow);

  // Convert camelCase/snake_case to Title Case
  const toTitleCase = (key: string): string => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/_/g, ' ')
      .replace(/^\s+/, '')
      .split(' ')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const headers = columnKeys.map(toTitleCase);
  const tableHeader = '| ' + headers.join(' | ') + ' |';
  const separator = '| ' + columnKeys.map(() => '---').join(' | ') + ' |';

  return { columnKeys, headers, tableHeader, separator };
}

/**
 * Build full markdown table for artifact.
 */
function buildFullTable(result: Text2CypherResult, spec: ColumnSpec): string {
  const { tableHeader, separator, columnKeys } = spec;
  const rows = result.results.map((row) => formatRow(row, columnKeys));

  return `# Text2Cypher Results\n\n**Query:** ${result.query}\n**Total Results:** ${result.rowCount}\n\n${tableHeader}\n${separator}\n${rows.join('\n')}`;
}

/**
 * Build context for LLM - full data if small, stats+sample if large.
 */
function buildLLMContext(result: Text2CypherResult, spec: ColumnSpec): string {
  const { tableHeader, separator, columnKeys } = spec;

  if (result.rowCount <= TRUNCATION_THRESHOLD) {
    // Give LLM all rows but truncate long text fields to manage token usage
    const rows = result.results.map((row) => formatRow(row, columnKeys, 150));
    return `**Cypher Executed:** \`${result.generatedCypher}\`
**Results:** ${result.rowCount} rows

${tableHeader}
${separator}
${rows.join('\n')}

Provide a helpful summary of these results. The full data is available in the artifact panel.`;
  }

  // Large result set - give LLM stats + sample
  const stats = computeStats(result, columnKeys);
  const sampleRows = result.results.slice(0, SAMPLE_SIZE).map((row) => formatRow(row, columnKeys));

  return `**Cypher Executed:** \`${result.generatedCypher}\`
**Total Results:** ${result.rowCount} rows (showing sample of ${SAMPLE_SIZE})

### Statistics
${stats}

### Sample Data
${tableHeader}
${separator}
${sampleRows.join('\n')}

Provide a summary highlighting key patterns. The full ${result.rowCount} results are available in the artifact panel.`;
}

/**
 * Compute basic statistics for large result sets.
 */
function computeStats(result: Text2CypherResult, columnKeys: string[]): string {
  const stats: string[] = [];

  // Find columns that look like categories/types (string columns with repeated values)
  for (const key of columnKeys) {
    const values = result.results.map((row) => row[key]).filter((v) => v != null);
    const uniqueValues = new Set(values.map((v) => String(v)));

    // If column has few unique values relative to total, show breakdown
    if (uniqueValues.size > 1 && uniqueValues.size <= 10 && uniqueValues.size < values.length * 0.5) {
      const counts: Record<string, number> = {};
      values.forEach((v) => {
        const strVal = String(v);
        counts[strVal] = (counts[strVal] || 0) + 1;
      });

      const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
      const breakdown = sorted
        .slice(0, 5)
        .map(([val, count]) => `${val}: ${count} (${Math.round((count / values.length) * 100)}%)`)
        .join(', ');

      const toTitleCase = (k: string): string =>
        k
          .replace(/([A-Z])/g, ' $1')
          .replace(/_/g, ' ')
          .trim()
          .split(' ')
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');

      stats.push(`- **${toTitleCase(key)}:** ${breakdown}`);
    }
  }

  return stats.length > 0 ? stats.join('\n') : '- No categorical breakdowns available';
}

/**
 * Format a single row as markdown table row.
 */
function formatRow(row: Record<string, unknown>, columnKeys: string[], maxCellLength?: number): string {
  const values = columnKeys.map((key) => {
    const val = row[key];
    if (val === null || val === undefined) {
      return '';
    }
    // Escape backslashes, pipe characters, and newlines for markdown tables
    let str = String(val).replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\n/g, ' ');
    if (maxCellLength && str.length > maxCellLength) {
      str = str.substring(0, maxCellLength) + '...';
    }
    return str;
  });
  return '| ' + values.join(' | ') + ' |';
}

/**
 * Format results as context for final LLM (non-enumeration path).
 */
function formatAsContext(result: Text2CypherResult): string {
  let context = `**Query:** ${result.query}\n\n`;
  context += '```json\n';
  context += JSON.stringify(result.results, null, 2);
  context += '\n```\n';
  return context;
}
