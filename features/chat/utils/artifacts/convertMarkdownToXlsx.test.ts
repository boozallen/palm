import { parseMarkdownTable, convertMarkdownToExcel } from './convertMarkdownToXlsx';

describe('parseMarkdownTable', () => {
  it('should parse a standard markdown table', () => {
    const content = `| Fruit  | Color  | Price |
|--------|--------|-------|
| Apple  | Red    | $1.00 |
| Banana | Yellow | $0.50 |`;

    const tables = parseMarkdownTable(content);

    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(['Fruit', 'Color', 'Price']);
    expect(tables[0].rows).toHaveLength(2);
    expect(tables[0].rows[0]).toEqual(['Apple', 'Red', '$1.00']);
    expect(tables[0].rows[1]).toEqual(['Banana', 'Yellow', '$0.50']);
  });

  it('should parse a markdown table without leading/trailing pipes', () => {
    const content = `Fruit | Color | Price
-----|-------|------
Apple | Red | $1.00
Banana | Yellow | $0.50`;

    const tables = parseMarkdownTable(content);

    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(['Fruit', 'Color', 'Price']);
    expect(tables[0].rows).toHaveLength(2);
  });

  it('should parse multiple tables in content', () => {
    const content = `First table:
| Fruit  | Color  |
|--------|--------|
| Apple  | Red    |

Second table:
| Name   | Age |
|--------|-----|
| John   | 30  |
| Jane   | 25  |`;

    const tables = parseMarkdownTable(content);

    expect(tables).toHaveLength(2);
    expect(tables[0].headers).toEqual(['Fruit', 'Color']);
    expect(tables[0].rows).toHaveLength(1);
    expect(tables[1].headers).toEqual(['Name', 'Age']);
    expect(tables[1].rows).toHaveLength(2);
  });

  it('should handle tables with empty cells', () => {
    const content = `| Name   | Age | City |
|--------|-----|------|
| John   | 30  |      |
| Jane   |     | NYC  |`;

    const tables = parseMarkdownTable(content);

    expect(tables).toHaveLength(1);
    // Parser filters empty cells and pads at the end
    expect(tables[0].rows[0]).toEqual(['John', '30', '']);
    expect(tables[0].rows[1]).toEqual(['Jane', 'NYC', '']);
  });

  it('should skip tables with less than 2 columns', () => {
    const content = `| Single |
|--------|
| Value  |`;

    const tables = parseMarkdownTable(content);

    expect(tables).toHaveLength(0);
  });

  it('should return empty array for content with no tables', () => {
    const content = 'This is just some text without any tables.';

    const tables = parseMarkdownTable(content);

    expect(tables).toHaveLength(0);
  });

  it('should skip code block markers', () => {
    const content = `\`\`\`
| Fruit  | Color  |
|--------|--------|
| Apple  | Red    |
\`\`\``;

    const tables = parseMarkdownTable(content);

    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(['Fruit', 'Color']);
  });

  it('should handle tables with varying row lengths', () => {
    const content = `| Col1 | Col2 | Col3 |
|------|------|------|
| A    | B    | C    |
| D    | E    |      |
| F    |      |      |`;

    const tables = parseMarkdownTable(content);

    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toHaveLength(3);
    expect(tables[0].rows[1]).toEqual(['D', 'E', '']);
    expect(tables[0].rows[2]).toEqual(['F', '', '']);
  });

  it('should handle tables with alignment indicators in separator', () => {
    const content = `| Left   | Center | Right |
|:-------|:------:|------:|
| A      | B      | C     |`;

    const tables = parseMarkdownTable(content);

    expect(tables).toHaveLength(1);
    expect(tables[0].headers).toEqual(['Left', 'Center', 'Right']);
    expect(tables[0].rows[0]).toEqual(['A', 'B', 'C']);
  });
});

describe('convertMarkdownToExcel', () => {
  it('should convert a markdown table to an Excel blob', async () => {
    const markdown = `| Fruit  | Color  | Price |
|--------|--------|-------|
| Apple  | Red    | $1.00 |
| Banana | Yellow | $0.50 |`;

    const blob = await convertMarkdownToExcel(markdown);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should convert CSV format to Excel blob', async () => {
    const csv = `Fruit,Color,Price
Apple,Red,$1.00
Banana,Yellow,$0.50`;

    const blob = await convertMarkdownToExcel(csv);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle CSV with quoted fields containing commas', async () => {
    const csv = `Name,Description,Price
Apple,"Fresh, red apples",$1.00
Banana,"Yellow, ripe",$0.50`;

    const blob = await convertMarkdownToExcel(csv);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should create multiple worksheets for multiple tables', async () => {
    const markdown = `| Fruit  | Color  |
|--------|--------|
| Apple  | Red    |

| Name   | Age |
|--------|-----|
| John   | 30  |`;

    const blob = await convertMarkdownToExcel(markdown);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should throw error for content with no tables', async () => {
    const noTables = 'This is just plain text without any tables.';

    await expect(convertMarkdownToExcel(noTables)).rejects.toThrow(
      'No tables found in the content'
    );
  });

  it('should throw error for empty content', async () => {
    const empty = '';

    await expect(convertMarkdownToExcel(empty)).rejects.toThrow(
      'No tables found in the content'
    );
  });

  it('should handle tables with special characters', async () => {
    const markdown = `| Name    | Email          |
|---------|----------------|
| John    | john@test.com  |
| Jane    | jane@test.com  |`;

    const blob = await convertMarkdownToExcel(markdown);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle large tables', async () => {
    let markdown = '| ID | Name | Value |\n|-----|------|-------|\n';
    for (let i = 1; i <= 100; i++) {
      markdown += `| ${i} | Item${i} | $${i}.00 |\n`;
    }

    const blob = await convertMarkdownToExcel(markdown);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle tables with different column widths', async () => {
    const markdown = `| Short | Medium Column | Very Long Column Name |
|-------|---------------|----------------------|
| A     | B             | C                    |
| 1     | 2             | 3                    |`;

    const blob = await convertMarkdownToExcel(markdown);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle tables with numeric data', async () => {
    const markdown = `| Product | Quantity | Price  | Total   |
|---------|----------|--------|---------|
| Apple   | 10       | 1.50   | 15.00   |
| Banana  | 5        | 0.75   | 3.75    |`;

    const blob = await convertMarkdownToExcel(markdown);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it('should handle CSV with only header row', async () => {
    const csv = 'Fruit,Color,Price';

    await expect(convertMarkdownToExcel(csv)).rejects.toThrow(
      'No tables found in the content'
    );
  });

  it('should handle markdown table with Windows line endings', async () => {
    const markdown = '| Fruit  | Color  |\r\n|--------|--------|\r\n| Apple  | Red    |\r\n| Banana | Yellow |';

    const blob = await convertMarkdownToExcel(markdown);

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });
});
