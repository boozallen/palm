import { parseFinancials } from './parseFinancials';

// Build a CSV row with specific columns set, all others blank.
// Columns are 0-indexed; the row must be at least 39 columns wide.
function buildRow(cols: Record<number, string>): string {
  const row = new Array(39).fill('');
  for (const [idx, val] of Object.entries(cols)) {
    row[Number(idx)] = val;
  }
  // Wrap values containing commas in quotes
  return row.map((v) => (v.includes(',') ? `"${v}"` : v)).join(',');
}

const HEADER = buildRow({});

function makeBuffer(rows: string[]): Buffer {
  return Buffer.from([HEADER, ...rows].join('\n'), 'utf-8');
}

// Convenience: a valid future row for a given job
// 'TASKORDER001CLIN' → taskOrder = slice(0,11) = 'TASKORDER00', clin = slice(-4) = 'CLIN'
// Use a 15-char string: first 11 = 'TASK001-001', last 4 = '0001'
const COSTPOINT_CLIN = 'TASK001-0010001'; // 15 chars

function futureRow(overrides: Record<number, string> = {}): string {
  return buildRow({
    2: 'Task Alpha',          // taskTitle
    3: COSTPOINT_CLIN,        // costpointClin — taskOrder = first 11, clin = last 4
    5: 'FFP',                 // type
    8: '1/1/2025',            // latestActual
    9: '3/1/2025',            // month (future)
    34: '100000',             // revenue
    36: '10000',              // profit  → 10%
    38: 'Planned',            // AorP
    ...overrides,
  });
}

describe('parseFinancials', () => {
  it('parses a basic future row', async () => {
    const rows = await parseFinancials(makeBuffer([futureRow()]));
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.taskTitle).toBe('Task Alpha');
    expect(row.taskOrder).toBe('TASK001-001'); // first 11 chars
    expect(row.clin).toBe('0001');              // last 4 chars
    expect(row.type).toBe('FFP');
    expect(row.revenue).toBe(100000);
    expect(row.profit).toBe(10000);
    expect(row.marginPct).toBeCloseTo(10, 5);
    expect(row.aorP).toBe('Planned');
  });

  it('skips rows where AorP is CTD Planned', async () => {
    const rows = await parseFinancials(
      makeBuffer([futureRow({ 38: 'CTD Planned' })]),
    );
    expect(rows).toHaveLength(0);
  });

  it('keeps Actual and Planned rows', async () => {
    const rows = await parseFinancials(
      makeBuffer([
        futureRow({ 38: 'Actual' }),
        futureRow({ 38: 'Planned' }),
      ]),
    );
    expect(rows).toHaveLength(2);
  });

  it('strips UTF-8 BOM from first row', async () => {
    const content = '\uFEFF' + [HEADER, futureRow()].join('\n');
    const rows = await parseFinancials(Buffer.from(content, 'utf-8'));
    expect(rows).toHaveLength(1);
  });

  it('handles commas inside number strings', async () => {
    const rows = await parseFinancials(
      makeBuffer([futureRow({ 34: '1,000,000', 36: '50,000' })]),
    );
    expect(rows[0].revenue).toBe(1000000);
    expect(rows[0].profit).toBe(50000);
  });

  it('sets marginPct to 0 when revenue is 0', async () => {
    const rows = await parseFinancials(
      makeBuffer([futureRow({ 34: '0', 36: '0' })]),
    );
    expect(rows[0].marginPct).toBe(0);
  });

  it('computes negative marginPct correctly', async () => {
    const rows = await parseFinancials(
      makeBuffer([futureRow({ 34: '100000', 36: '-5000' })]),
    );
    expect(rows[0].marginPct).toBeCloseTo(-5, 5);
  });

  it('skips rows with empty date columns', async () => {
    const rows = await parseFinancials(
      makeBuffer([futureRow({ 8: '', 9: '' })]),
    );
    expect(rows).toHaveLength(0);
  });

  it('throws when the file has no data rows', async () => {
    await expect(parseFinancials(makeBuffer([]))).rejects.toThrow(
      'File contains no data rows.',
    );
  });

  it('sets jobKey as taskOrder__clin', async () => {
    const rows = await parseFinancials(makeBuffer([futureRow()]));
    expect(rows[0].jobKey).toBe('TASK001-001__0001');
  });

  it('correctly identifies historical vs future rows via latestActual', async () => {
    const historicalRow = buildRow({
      2: 'Task B',
      3: COSTPOINT_CLIN,
      5: 'T&M',
      8: '3/1/2025',   // latestActual
      9: '1/1/2025',   // month < latestActual → historical
      34: '50000',
      36: '2500',
      38: 'Actual',
    });
    const rows = await parseFinancials(makeBuffer([historicalRow]));
    expect(rows).toHaveLength(1);
    expect(rows[0].month <= rows[0].latestActual).toBe(true);
  });
});
