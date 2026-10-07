import puppeteer, { type Browser } from 'puppeteer';

import PdfRendererUnavailableError from '@/features/ai-agents/utils/pulse/results/pdfRendererError';

// Same sandbox flags the crawler launches Chromium with inside the container.
export const PDF_LAUNCH_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

/**
 * Prints self-contained HTML to Letter PDF bytes. A renderer that won't start throws
 * PdfRendererUnavailableError and a failed print throws its own error; the browser is
 * always closed once it has launched.
 */
export default async function renderPdf(html: string): Promise<Buffer> {
  let browser: Browser;

  try {
    browser = await puppeteer.launch({
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
      headless: true,
      args: PDF_LAUNCH_ARGS,
    });
  } catch (error) {
    throw new PdfRendererUnavailableError((error as Error).message);
  }

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'load' });
    const pdf = await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}
