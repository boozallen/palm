import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RunDownloads, { fileStem } from '@/features/ai-agents/components/pulse/RunDownloads';
import buildResultsWorkbook from '@/features/ai-agents/utils/pulse/buildResultsWorkbook';
import downloadBlob from '@/features/ai-agents/utils/pulse/downloadBlob';
import showPulseError from '@/features/ai-agents/utils/pulse/showPulseError';
import { LEGACY_OUTPUT_REASON } from '@/features/ai-agents/utils/pulse/outputReasons';
import type { PulseRunView } from '@/features/ai-agents/types/pulse/results';

const mockFetchOutput = jest.fn();

jest.mock('@/features/ai-agents/api/pulse/get-pulse-output', () => ({
  __esModule: true,
  default: () => ({ fetch: mockFetchOutput }),
}));

jest.mock('@/features/ai-agents/utils/pulse/buildResultsWorkbook', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/features/ai-agents/utils/pulse/downloadBlob', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('@/features/ai-agents/utils/pulse/showPulseError', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const mockBuildWorkbook = buildResultsWorkbook as jest.Mock;
const mockDownloadBlob = downloadBlob as jest.Mock;
const mockShowPulseError = showPulseError as jest.Mock;

const RUN: PulseRunView = {
  id: 'job-1',
  status: 'succeeded',
  surveyFilename: 'symposium.xlsx',
  modelName: 'Opus 5',
  createdAt: '2026-09-25T14:00:00.000Z',
  completedAt: '2026-09-25T14:02:05.000Z',
  rowsInFile: 123,
  rowsAnalyzed: 115,
  failedRowCount: 5,
  message: null,
  fallbacksByColumn: [],
  recommendedActions: null,
  outputs: { dashboard: null, pdf: null, slides: null },
  hasLegacyOutputs: false,
};

function renderDownloads(overrides: Partial<PulseRunView> = {}) {
  return render(<RunDownloads agentId='agent-1' run={{ ...RUN, ...overrides }} fields={[]} results={[]} />);
}

function downloadedBlob(): Blob {
  return mockDownloadBlob.mock.calls[0][0] as Blob;
}

describe('RunDownloads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildWorkbook.mockResolvedValue(new Blob(['xlsx']));
    mockFetchOutput.mockResolvedValue({
      output: 'dashboard',
      mimeType: 'text/html',
      encoding: 'utf8',
      content: '<!doctype html><html></html>',
    });
  });

  it('offers all four downloads for a finished run', () => {
    renderDownloads();

    expect(screen.getByTestId('pulse-download-xlsx')).toBeEnabled();
    expect(screen.getByTestId('pulse-download-dashboard')).toBeEnabled();
    expect(screen.getByTestId('pulse-download-pdf')).toBeEnabled();
    expect(screen.getByTestId('pulse-download-slides')).toBeEnabled();
  });

  it('builds the results spreadsheet in the browser', async () => {
    renderDownloads();

    await userEvent.click(screen.getByTestId('pulse-download-xlsx'));

    await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalledWith(expect.any(Blob), 'symposium-pulse-results.xlsx'));
    expect(mockBuildWorkbook).toHaveBeenCalledWith({ results: [], fields: [], surveyFilename: 'symposium.xlsx' });
    expect(mockFetchOutput).not.toHaveBeenCalled();
  });

  it('downloads the results dashboard as an HTML file', async () => {
    renderDownloads();

    await userEvent.click(screen.getByTestId('pulse-download-dashboard'));

    await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalled());
    expect(mockFetchOutput).toHaveBeenCalledWith({ agentId: 'agent-1', jobId: 'job-1', output: 'dashboard' });
    expect(mockDownloadBlob.mock.calls[0][1]).toBe('symposium-results-dashboard.html');
    expect(downloadedBlob().type).toBe('text/html;charset=utf-8');
  });

  it('downloads the slides as an HTML file', async () => {
    renderDownloads();

    await userEvent.click(screen.getByTestId('pulse-download-slides'));

    await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalled());
    expect(mockFetchOutput).toHaveBeenCalledWith({ agentId: 'agent-1', jobId: 'job-1', output: 'slides' });
    expect(mockDownloadBlob.mock.calls[0][1]).toBe('symposium-slides.html');
    expect(downloadedBlob().type).toBe('text/html;charset=utf-8');
  });

  it('downloads the executive summary as PDF bytes, not base64 text', async () => {
    mockFetchOutput.mockResolvedValue({ output: 'pdf', mimeType: 'application/pdf', encoding: 'base64', content: 'JVBERi0=' });
    renderDownloads();

    await userEvent.click(screen.getByTestId('pulse-download-pdf'));

    await waitFor(() => expect(mockDownloadBlob).toHaveBeenCalled());
    expect(mockFetchOutput).toHaveBeenCalledWith({ agentId: 'agent-1', jobId: 'job-1', output: 'pdf' });
    expect(mockDownloadBlob.mock.calls[0][1]).toBe('symposium-executive-summary.pdf');
    expect(downloadedBlob().type).toBe('application/pdf');
    // 'JVBERi0=' is the five bytes '%PDF-'.
    expect(downloadedBlob().size).toBe(5);
  });

  it('disables an output that failed and says why without being hovered', () => {
    renderDownloads({
      outputs: { dashboard: null, pdf: 'The PDF couldn\'t be rendered because Chromium isn\'t available.', slides: null },
    });

    expect(screen.getByTestId('pulse-download-pdf')).toBeDisabled();
    expect(screen.getByTestId('pulse-download-dashboard')).toBeEnabled();
    expect(screen.getByTestId('pulse-download-pdf-reason')).toHaveTextContent('Chromium');
    expect(screen.queryByTestId('pulse-download-dashboard-reason')).not.toBeInTheDocument();
  });

  // Anyone reading the button by keyboard or screen reader is given the reason with it.
  it('names the reason as the disabled button\'s description', () => {
    renderDownloads({
      outputs: { dashboard: null, pdf: 'The PDF couldn\'t be rendered.', slides: null },
    });

    expect(screen.getByTestId('pulse-download-pdf')).toHaveAttribute(
      'aria-describedby',
      screen.getByTestId('pulse-download-pdf-reason').id,
    );
  });

  it('keeps the spreadsheet available for a run from before this update', async () => {
    renderDownloads({ hasLegacyOutputs: true, outputs: { dashboard: LEGACY_OUTPUT_REASON, pdf: LEGACY_OUTPUT_REASON, slides: LEGACY_OUTPUT_REASON } });

    expect(screen.getByTestId('pulse-download-xlsx')).toBeEnabled();
    expect(screen.getByTestId('pulse-download-dashboard')).toBeDisabled();
    expect(screen.getByTestId('pulse-download-pdf')).toBeDisabled();
    expect(screen.getByTestId('pulse-download-slides')).toBeDisabled();
    expect(screen.getByTestId('pulse-downloads-legacy')).toHaveTextContent('before this update');
    // One note covers all three at once rather than repeating itself per button.
    expect(screen.queryByTestId('pulse-download-slides-reason')).not.toBeInTheDocument();
    expect(screen.getByTestId('pulse-download-slides')).not.toHaveAttribute('aria-describedby');
  });

  it('says nothing about older runs for a run with outputs', () => {
    renderDownloads();

    expect(screen.queryByTestId('pulse-downloads-legacy')).not.toBeInTheDocument();
  });

  it('shows the cause and fix when a download fails', async () => {
    const error = new Error('The results output isn\'t available.');
    mockFetchOutput.mockRejectedValue(error);
    renderDownloads();

    await userEvent.click(screen.getByTestId('pulse-download-dashboard'));

    await waitFor(() => expect(mockShowPulseError).toHaveBeenCalledWith(error, 'Download failed'));
    expect(mockDownloadBlob).not.toHaveBeenCalled();
    expect(screen.getByTestId('pulse-download-dashboard')).toBeEnabled();
  });
});

describe('fileStem', () => {
  it.each([
    ['symposium.xlsx', 'symposium'],
    ['q3.survey.final.xlsx', 'q3.survey.final'],
    ['no-extension', 'no-extension'],
    ['.xlsx', 'pulse'],
    ['', 'pulse'],
  ])('names downloads for %s after %s', (surveyFilename, expected) => {
    expect(fileStem(surveyFilename)).toBe(expected);
  });
});
