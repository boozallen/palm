import * as ExcelJS from 'exceljs';
import { strToU8, unzipSync, zipSync } from 'fflate';

import loadWorkbook from '@/features/ai-agents/utils/pulse/loadWorkbook';

// docProps/core.xml as Microsoft Forms writes it: a default namespace, so every child
// element arrives without the prefix the reader matches on.
const FORMS_CORE_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<coreProperties xmlns="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <creator>Microsoft Forms</creator>
  <lastModifiedBy>Microsoft Forms</lastModifiedBy>
</coreProperties>`;

async function surveyWorkbook(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Responses');

  sheet.addRow(['ID', 'Comments']);
  sheet.addRow([1, 'Great event']);

  return workbook.xlsx.writeBuffer() as Promise<ArrayBuffer>;
}

function withFormsMetadata(data: ArrayBuffer): ArrayBuffer {
  const parts = unzipSync(new Uint8Array(data));

  parts['docProps/core.xml'] = strToU8(FORMS_CORE_XML);

  const rewritten = zipSync(parts, { level: 0 });

  return rewritten.buffer.slice(
    rewritten.byteOffset,
    rewritten.byteOffset + rewritten.byteLength,
  ) as ArrayBuffer;
}

describe('loadWorkbook', () => {
  it('reads a workbook exported straight from Microsoft Forms', async () => {
    const workbook = await loadWorkbook(withFormsMetadata(await surveyWorkbook()));

    expect(workbook.getWorksheet('Responses')?.getCell('B2').value).toBe('Great event');
  });

  it('keeps every response row when it has to repair the file', async () => {
    const workbook = await loadWorkbook(withFormsMetadata(await surveyWorkbook()));

    expect(workbook.getWorksheet('Responses')?.rowCount).toBe(2);
  });

  it('reads a workbook that was already valid', async () => {
    const workbook = await loadWorkbook(await surveyWorkbook());

    expect(workbook.getWorksheet('Responses')?.getCell('B2').value).toBe('Great event');
  });

  it('reports a file that is not a workbook at all', async () => {
    await expect(loadWorkbook(new ArrayBuffer(8))).rejects.toThrow();
  });
});
