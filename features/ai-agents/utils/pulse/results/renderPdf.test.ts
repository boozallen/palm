/**
 * @jest-environment node
 */
import puppeteer, { type Browser } from 'puppeteer';

import PdfRendererUnavailableError from '@/features/ai-agents/utils/pulse/results/pdfRendererError';
import renderPdf from '@/features/ai-agents/utils/pulse/results/renderPdf';

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: { launch: jest.fn() },
}));

const launchMock = jest.mocked(puppeteer.launch);
const PDF_BYTES = new Uint8Array([37, 80, 68, 70]);
const HTML = '<!DOCTYPE html><html><body>Summary</body></html>';

function mockBrowser(pdf: () => Promise<Uint8Array>) {
  const page = {
    setContent: jest.fn(async (): Promise<void> => undefined),
    pdf: jest.fn(pdf),
  };
  const browser = {
    newPage: jest.fn(async () => page),
    close: jest.fn(async (): Promise<void> => undefined),
  };
  launchMock.mockResolvedValue(browser as unknown as Browser);
  return { page, browser };
}

describe('renderPdf', () => {
  const originalPath = process.env.PUPPETEER_EXECUTABLE_PATH;

  beforeEach(() => {
    process.env.PUPPETEER_EXECUTABLE_PATH = '/usr/bin/chromium-browser';
  });

  afterEach(() => {
    launchMock.mockReset();
    if (originalPath === undefined) {
      delete process.env.PUPPETEER_EXECUTABLE_PATH;
    } else {
      process.env.PUPPETEER_EXECUTABLE_PATH = originalPath;
    }
  });

  it('launches headless Chromium from PUPPETEER_EXECUTABLE_PATH without the sandbox', async () => {
    mockBrowser(async () => PDF_BYTES);

    await renderPdf(HTML);

    expect(launchMock).toHaveBeenCalledWith(expect.objectContaining({
      executablePath: '/usr/bin/chromium-browser',
      headless: true,
      args: expect.arrayContaining(['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']),
    }));
  });

  it('sets the HTML, prints a Letter PDF with backgrounds, and returns its bytes', async () => {
    const { page } = mockBrowser(async () => PDF_BYTES);

    const result = await renderPdf(HTML);

    expect(page.setContent).toHaveBeenCalledWith(HTML, { waitUntil: 'load' });
    expect(page.pdf).toHaveBeenCalledWith(expect.objectContaining({ format: 'Letter', printBackground: true }));
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.equals(Buffer.from(PDF_BYTES))).toBe(true);
  });

  it('closes the browser after printing', async () => {
    const { browser } = mockBrowser(async () => PDF_BYTES);

    await renderPdf(HTML);

    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('closes the browser and rethrows when printing fails', async () => {
    const { browser } = mockBrowser(async () => {
      throw new Error('Chromium crashed');
    });

    await expect(renderPdf(HTML)).rejects.toThrow('Chromium crashed');
    expect(browser.close).toHaveBeenCalledTimes(1);
  });

  it('closes the browser and rethrows when the content cannot be set', async () => {
    const { page, browser } = mockBrowser(async () => PDF_BYTES);
    page.setContent.mockRejectedValueOnce(new Error('Navigation timeout'));

    await expect(renderPdf(HTML)).rejects.toThrow('Navigation timeout');
    expect(browser.close).toHaveBeenCalledTimes(1);
    expect(page.pdf).not.toHaveBeenCalled();
  });

  // The caller tells a missing renderer apart from a run that printed badly.
  it('reports Chromium missing as the renderer being unavailable', async () => {
    launchMock.mockRejectedValue(new Error('Could not find Chrome'));

    await expect(renderPdf(HTML)).rejects.toThrow(PdfRendererUnavailableError);
    await expect(renderPdf(HTML)).rejects.toThrow('Could not find Chrome');
  });

  it('reports a printing failure as something other than the renderer being unavailable', async () => {
    mockBrowser(async () => {
      throw new Error('Page crashed');
    });

    await expect(renderPdf(HTML)).rejects.not.toThrow(PdfRendererUnavailableError);
  });
});
