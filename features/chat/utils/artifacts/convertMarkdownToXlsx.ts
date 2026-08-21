import * as ExcelJS from 'exceljs';

interface ParsedTable {
  headers: string[];
  rows: string[][];
}

export const parseMarkdownTable = (content: string): ParsedTable[] => {
  const tables: ParsedTable[] = [];
  const lines = content.split(/\r?\n/); // Handle both \n and \r\n
  let i = 0;

  while (i < lines.length) {
    let line = lines[i].trim();

    // Skip code block markers
    if (line.startsWith('```')) {
      i++;
      continue;
    }

    // Check if this line looks like a table header (contains pipes and at least 2 columns)
    if (line.includes('|')) {
      // Parse header row - handle both formats: |col1|col2| and col1|col2
      const headerParts = line.split('|').map(cell => cell.trim()).filter(cell => cell.length > 0);

      // Need at least 2 columns to be a valid table
      if (headerParts.length < 2) {
        i++;
        continue;
      }

      // Check if next line is a separator (contains dashes and pipes)
      if (i + 1 < lines.length) {
        const separatorLine = lines[i + 1].trim();

        // Separator must have dashes and pipes, and match header column count
        const separatorParts = separatorLine.split('|').filter(part => part.trim().length > 0);
        const hasDashes = separatorLine.includes('-');
        const hasPipes = separatorLine.includes('|');
        const matchesColumnCount = separatorParts.length === headerParts.length ||
                                   separatorParts.every(part => /^[\s:-]+$/.test(part));

        if (hasDashes && hasPipes && matchesColumnCount) {
          i += 2; // Skip header and separator lines

          // Parse data rows
          const rows: string[][] = [];
          while (i < lines.length) {
            const dataLine = lines[i].trim();

            // Stop at code blocks or empty table rows
            if (dataLine.startsWith('```') || !dataLine.includes('|')) {
              break;
            }

            const rowParts = dataLine
              .split('|')
              .map(cell => cell.trim())
              .filter(cell => cell.length > 0);

            // Only add rows with data
            if (rowParts.length > 0) {
              // Pad row to match header length if needed
              while (rowParts.length < headerParts.length) {
                rowParts.push('');
              }
              rows.push(rowParts);
            }
            i++;
          }

          // Only add table if we found headers and at least one row
          if (headerParts.length >= 2 && rows.length > 0) {
            tables.push({ headers: headerParts, rows });
          }
        } else {
          i++;
        }
      } else {
        i++;
      }
    } else {
      i++;
    }
  }

  return tables;
};

const parseCSVTable = (content: string): ParsedTable | null => {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);

  if (lines.length < 2) {
    return null; // Need at least header and one data row
  }

  // Simple CSV parser - handles quoted fields with commas
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  const headers = parseCSVLine(lines[0]);

  if (headers.length < 2) {
    return null; // Need at least 2 columns
  }

  const rows = lines.slice(1).map(line => parseCSVLine(line));

  return { headers, rows };
};

export const convertMarkdownToExcel = async (content: string): Promise<Blob> => {
  // First try to parse as markdown tables
  let tables = parseMarkdownTable(content);

  // If no markdown tables found, try parsing as CSV
  if (tables.length === 0) {
    const csvTable = parseCSVTable(content);
    if (csvTable) {
      tables = [csvTable];
    }
  }

  if (tables.length === 0) {
    throw new Error('No tables found in the content. Make sure the content includes properly formatted markdown tables or CSV data.');
  }

  try {
    // Create a new workbook
    const workbook = new ExcelJS.Workbook();

    // Add each table as a separate worksheet
    tables.forEach((table, index) => {
      // Add worksheet to workbook with appropriate name
      const sheetName = tables.length === 1 ? 'Sheet1' : `Table ${index + 1}`;
      const worksheet = workbook.addWorksheet(sheetName);

      // Add header row
      const headerRow = worksheet.addRow(table.headers);
      headerRow.font = { bold: true };

      // Add data rows
      table.rows.forEach(row => {
        worksheet.addRow(row);
      });

      // Auto-size columns based on content
      worksheet.columns = table.headers.map((header, colIndex) => {
        const headerLength = header.length;
        const maxDataLength = Math.max(
          ...table.rows.map(row => (row[colIndex] || '').length),
          0 // Fallback to 0 if no rows
        );
        return {
          width: Math.max(headerLength, maxDataLength, 10) + 2,
        };
      });
    });

    // Write the workbook to a buffer
    const buffer = await workbook.xlsx.writeBuffer();

    // Convert to Blob with correct MIME type
    return new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
  } catch (error) {
    console.error('Error creating Excel file:', error);
    throw new Error(`Failed to create Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};
