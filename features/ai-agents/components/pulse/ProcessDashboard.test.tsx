import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import ProcessDashboard, { formatDuration } from '@/features/ai-agents/components/pulse/ProcessDashboard';
import { appTheme } from '@/providers/AppMantineProvider';
import type { PulseRunView } from '@/features/ai-agents/types/pulse/results';

jest.mock('@/features/ai-agents/components/pulse/RunDownloads', () => ({
  __esModule: true,
  default: () => <div data-testid='pulse-downloads' />,
}));

const RUN: PulseRunView = {
  id: 'job-1',
  status: 'succeeded',
  surveyFilename: 'symposium.xlsx',
  modelName: 'Opus 5',
  createdAt: '2026-09-25T14:00:00.000Z',
  completedAt: '2026-09-25T14:02:05.000Z',
  rowsInFile: 120,
  rowsAnalyzed: 115,
  failedRowCount: 5,
  message: null,
  fallbacksByColumn: [
    { fieldName: 'Sentiment', count: 4 },
    { fieldName: 'Theme', count: 0 },
  ],
  recommendedActions: [
    { action: 'Shorten the keynote.', rationale: 'Most attendees rated it too long.' },
    { action: 'Add networking time.', rationale: 'Networking was the top-rated session.' },
    { action: 'Publish slides sooner.', rationale: 'Many asked for the slides.' },
  ],
  outputs: { dashboard: null, pdf: null, slides: null },
  hasLegacyOutputs: false,
};

function renderDashboard(overrides: Partial<PulseRunView> = {}) {
  return render(
    <MantineProvider theme={appTheme}>
      <ProcessDashboard agentId='agent-1' run={{ ...RUN, ...overrides }} fields={[]} results={[]} />
    </MantineProvider>,
  );
}

describe('ProcessDashboard', () => {
  it('reports a clean run as succeeded with no message', () => {
    renderDashboard();

    expect(screen.getByTestId('pulse-run-status')).toHaveTextContent('Succeeded');
    expect(screen.queryByTestId('pulse-run-message')).not.toBeInTheDocument();
  });

  it('reports a run with a warning and says what happened and what to do', () => {
    renderDashboard({
      status: 'succeededWithWarnings',
      message: { cause: '5 of 120 responses could not be analyzed.', fix: 'Run it again to retry them.' },
    });

    expect(screen.getByTestId('pulse-run-status')).toHaveTextContent('Succeeded with warnings');
    expect(screen.getByTestId('pulse-run-message-cause')).toHaveTextContent('5 of 120 responses');
    expect(screen.getByTestId('pulse-run-message-fix')).toHaveTextContent('Run it again');
  });

  it('reports a failed run with its cause and fix', () => {
    renderDashboard({
      status: 'failed',
      message: { cause: 'The analysis queue isn\'t running.', fix: 'Try again in a few minutes.' },
    });

    expect(screen.getByTestId('pulse-run-status')).toHaveTextContent('Failed');
    expect(screen.getByTestId('pulse-run-message-cause')).toHaveTextContent('queue');
    expect(screen.getByTestId('pulse-run-message-fix')).toHaveTextContent('Try again');
  });

  it('shows a failure cause alone when there is no fix', () => {
    renderDashboard({ status: 'failed', message: { cause: 'Something broke.', fix: null } });

    expect(screen.getByTestId('pulse-run-message-cause')).toBeInTheDocument();
    expect(screen.queryByTestId('pulse-run-message-fix')).not.toBeInTheDocument();
  });

  it('shows rows in file, analyzed, and failed rows, with no blank-row count', () => {
    renderDashboard();

    expect(screen.getByTestId('pulse-stat-rows-in-file')).toHaveTextContent('120');
    expect(screen.getByTestId('pulse-stat-rows-analyzed')).toHaveTextContent('115');
    expect(screen.getByTestId('pulse-stat-skipped-failed')).toHaveTextContent('5');
    expect(screen.queryByTestId('pulse-stat-skipped-blank')).not.toBeInTheDocument();
  });

  it('shows a dash for counts an older run never recorded', () => {
    renderDashboard({ rowsInFile: null, rowsAnalyzed: null, failedRowCount: null });

    expect(screen.getByTestId('pulse-stat-rows-in-file')).toHaveTextContent('—');
    expect(screen.getByTestId('pulse-stat-skipped-failed')).toHaveTextContent('—');
  });

  it('lists only the columns that fell back at least once', () => {
    renderDashboard();

    const rows = screen.getAllByTestId('pulse-fallback-row');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent('Sentiment');
    expect(rows[0]).toHaveTextContent('4');
  });

  it('hides the fallbacks section when no column fell back', () => {
    renderDashboard({ fallbacksByColumn: [{ fieldName: 'Theme', count: 0 }] });

    expect(screen.queryByTestId('pulse-fallbacks')).not.toBeInTheDocument();
  });

  it('shows the model, file, start, finish, and duration of the run', () => {
    renderDashboard();

    expect(screen.getByTestId('pulse-run-model')).toHaveTextContent('Opus 5');
    expect(screen.getByTestId('pulse-run-file')).toHaveTextContent('symposium.xlsx');
    expect(screen.getByTestId('pulse-run-started')).toHaveTextContent('2026');
    expect(screen.getByTestId('pulse-run-finished')).toHaveTextContent('2026');
    expect(screen.getByTestId('pulse-run-duration')).toHaveTextContent('2m 5s');
  });

  it('shows a dash for the finish and duration of a run that never finished', () => {
    renderDashboard({ status: 'failed', completedAt: null, modelName: null });

    expect(screen.getByTestId('pulse-run-finished')).toHaveTextContent('—');
    expect(screen.getByTestId('pulse-run-duration')).toHaveTextContent('—');
    expect(screen.getByTestId('pulse-run-model')).toHaveTextContent('—');
  });

  it('lists every recommended action with its rationale', () => {
    renderDashboard();

    const actions = screen.getAllByTestId('pulse-next-action');

    expect(actions).toHaveLength(3);
    expect(actions[0]).toHaveTextContent('Shorten the keynote.');
    expect(actions[0]).toHaveTextContent('Most attendees rated it too long.');
  });

  it('points to the results dashboard when no actions were generated', () => {
    renderDashboard({ recommendedActions: null });

    expect(screen.getByTestId('pulse-next-steps-missing')).toHaveTextContent('results dashboard');
    expect(screen.queryByTestId('pulse-next-action')).not.toBeInTheDocument();
  });

  it('treats an empty list of actions as not generated', () => {
    renderDashboard({ recommendedActions: [] });

    expect(screen.getByTestId('pulse-next-steps-missing')).toBeInTheDocument();
  });

  it('offers no next steps for a failed run', () => {
    renderDashboard({ status: 'failed', message: { cause: 'Broke.', fix: null } });

    expect(screen.queryByTestId('pulse-next-steps')).not.toBeInTheDocument();
  });

  it('always offers the downloads', () => {
    renderDashboard({ status: 'failed', message: { cause: 'Broke.', fix: null } });

    expect(screen.getByTestId('pulse-downloads')).toBeInTheDocument();
  });
});

describe('formatDuration', () => {
  it.each([
    ['2026-09-25T14:00:00.000Z', '2026-09-25T14:00:42.000Z', '42s'],
    ['2026-09-25T14:00:00.000Z', '2026-09-25T14:02:05.000Z', '2m 5s'],
    ['2026-09-25T14:00:00.000Z', '2026-09-25T15:07:30.000Z', '1h 7m'],
    ['2026-09-25T14:00:00.000Z', null, '—'],
    ['not a date', '2026-09-25T14:00:00.000Z', '—'],
    ['2026-09-25T14:00:10.000Z', '2026-09-25T14:00:00.000Z', '—'],
  ])('formats %s to %s as %s', (startedAt, finishedAt, expected) => {
    expect(formatDuration(startedAt, finishedAt)).toBe(expected);
  });
});
