import * as ExcelJS from 'exceljs';
import { unzipSync, zipSync } from 'fflate';

// Author, application, and timestamps. Reading rows never touches any of them.
const METADATA_PARTS = ['docProps/core.xml', 'docProps/app.xml'];

async function readWorkbook(data: ArrayBuffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();

  await workbook.xlsx.load(data);

  return workbook;
}

// Stored rather than deflated, because nothing reads this copy but the retry below.
function withoutMetadataParts(data: ArrayBuffer): ArrayBuffer {
  const parts = unzipSync(new Uint8Array(data));

  METADATA_PARTS.forEach((part) => delete parts[part]);

  const rewritten = zipSync(parts, { level: 0 });

  return rewritten.buffer.slice(
    rewritten.byteOffset,
    rewritten.byteOffset + rewritten.byteLength,
  ) as ArrayBuffer;
}

/**
 * Loads an uploaded workbook, repairing the one thing real exports get wrong. Microsoft
 * Forms declares its document properties under a default namespace, so the reader meets
 * tags it only recognizes namespace-prefixed and rejects the entire file. A second pass
 * without those parts loses nothing that reading rows uses. A workbook that loads on the
 * first attempt is never rewritten, and a file broken for any other reason still throws.
 */
export default async function loadWorkbook(data: ArrayBuffer | Buffer): Promise<ExcelJS.Workbook> {
  const buffer = data as ArrayBuffer;

  try {
    return await readWorkbook(buffer);
  } catch {
    return readWorkbook(withoutMetadataParts(buffer));
  }
}
