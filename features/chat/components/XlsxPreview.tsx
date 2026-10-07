import { Center, Loader, Text, Group, UnstyledButton } from '@mantine/core';
import { useEffect, useState } from 'react';

type CellData = {
  value: string;
  bgColor: string | null;
  textColor: string | null;
  bold: boolean;
  italic: boolean;
  align: 'left' | 'center' | 'right';
  colSpan?: number;
};

type SheetData = {
  name: string;
  rows: (CellData | null)[][];
  colCount: number;
};

type Props = {
  artifactId: string;
  csvContent?: string;
};

function colLetter(n: number): string {
  let s = '';
  let idx = n;
  while (idx >= 0) {
    s = String.fromCharCode(65 + (idx % 26)) + s;
    idx = Math.floor(idx / 26) - 1;
  }
  return s;
}

function autoContrastColor(bgHex: string): string {
  const hex = bgHex.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

function parseCsv(csvString: string): SheetData[] {
  const lines = csvString.split(/\r?\n/);
  // Strip trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1]?.trim() === '') {
    lines.pop();
  }
  if (lines.length === 0) {
    return [{ name: 'Sheet1', rows: [], colCount: 0 }];
  }

  const parseRow = (line: string): string[] => {
    const cells: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuote) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuote = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuote = true;
      } else if (ch === ',') {
        cells.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  };

  const rows = lines.map((line) => parseRow(line).map((value): CellData => ({
    value,
    bgColor: null,
    textColor: null,
    bold: false,
    italic: false,
    align: 'left',
  })));

  const colCount = Math.max(...rows.map((r) => r.length), 0);
  return [{ name: 'Sheet1', rows, colCount }];
}

async function fetchXlsxPreview(artifactId: string): Promise<SheetData[]> {
  const res = await fetch(`/api/chat/artifacts/xlsx-preview?id=${artifactId}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch spreadsheet preview (${res.status})`);
  }
  const data = await res.json() as { sheets: SheetData[] };
  return data.sheets;
}

const XlsxPreview = ({ artifactId, csvContent }: Props) => {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const parsed = csvContent !== undefined
          ? parseCsv(csvContent)
          : await fetchXlsxPreview(artifactId);
        if (!cancelled) {
          setSheets(parsed);
          setActiveSheet(0);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render spreadsheet');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [artifactId, csvContent]);

  if (error) {
    return (
      <Center h='100%'>
        <Text size='sm' color='dimmed'>{error}</Text>
      </Center>
    );
  }

  if (loading) {
    return (
      <Center h='100%'>
        <Loader size='sm' />
      </Center>
    );
  }

  const sheet = sheets[activeSheet];
  if (!sheet) {
    return (
      <Center h='100%'>
        <Text size='sm' color='dimmed'>No data</Text>
      </Center>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#fff', fontFamily: 'Calibri, Arial, sans-serif', fontSize: 12 }}>
      {/* Spreadsheet grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', tableLayout: 'fixed', minWidth: '100%' }}>
          <thead>
            <tr>
              {/* Row number header corner */}
              <th style={{ width: 40, minWidth: 40, background: '#f2f2f2', border: '1px solid #d0d0d0', position: 'sticky', top: 0, left: 0, zIndex: 3 }} />
              {Array.from({ length: sheet.colCount }, (_, i) => (
                <th
                  key={i}
                  style={{
                    width: 100,
                    minWidth: 60,
                    background: '#f2f2f2',
                    border: '1px solid #d0d0d0',
                    textAlign: 'center',
                    fontWeight: 600,
                    color: '#555',
                    padding: '2px 4px',
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                  }}
                >
                  {colLetter(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.rows.map((row, rIdx) => (
              <tr key={rIdx}>
                {/* Row number */}
                <td style={{
                  background: '#f2f2f2',
                  border: '1px solid #d0d0d0',
                  textAlign: 'center',
                  color: '#555',
                  fontWeight: 600,
                  padding: '2px 4px',
                  position: 'sticky',
                  left: 0,
                  zIndex: 1,
                  minWidth: 40,
                  width: 40,
                }}>
                  {rIdx + 1}
                </td>
                {row.map((cell, cIdx) => {
                  if (cell === null) {
                    return null;
                  }
                  const textColor = cell.textColor ?? (cell.bgColor ? autoContrastColor(cell.bgColor) : '#000');
                  return (
                    <td
                      key={cIdx}
                      colSpan={cell.colSpan ?? 1}
                      style={{
                        border: '1px solid #d0d0d0',
                        padding: '2px 6px',
                        background: cell.bgColor ?? '#fff',
                        color: textColor,
                        fontWeight: cell.bold ? 700 : 400,
                        fontStyle: cell.italic ? 'italic' : 'normal',
                        textAlign: cell.align,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: 200,
                      }}
                    >
                      {cell.value}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <Group spacing={0} style={{ borderTop: '1px solid #d0d0d0', background: '#f2f2f2', flexShrink: 0 }}>
          {sheets.map((s, i) => (
            <UnstyledButton
              key={i}
              onClick={() => setActiveSheet(i)}
              style={{
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: i === activeSheet ? 700 : 400,
                borderRight: '1px solid #d0d0d0',
                borderTop: i === activeSheet ? '2px solid #1a73e8' : '2px solid transparent',
                background: i === activeSheet ? '#fff' : 'transparent',
                color: '#333',
                cursor: 'pointer',
              }}
            >
              {s.name}
            </UnstyledButton>
          ))}
        </Group>
      )}
    </div>
  );
};

export default XlsxPreview;
