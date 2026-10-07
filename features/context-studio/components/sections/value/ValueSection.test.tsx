import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JSX } from 'react';
import { MantineProvider } from '@mantine/core';

import ValueSection from './ValueSection';
import useGetValueSummary from '@/features/context-studio/api/get-value-summary';
import { TimeRange } from '@/features/context-studio/types/context-studio';
import { ValueSummary } from '@/features/context-studio/types/value';
import { UseCase } from '@/features/shared/types/use-case';
import { appTheme } from '@/providers/AppMantineProvider';

jest.mock('@/features/context-studio/api/get-value-summary', () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock('./UseCaseDetailDrawer', () => ({
  __esModule: true,
  default: jest.fn(({ useCase }) =>
    useCase !== null ? <div data-testid='use-case-detail-drawer' /> : null
  ),
}));

const renderWithTheme = (ui: JSX.Element) =>
  render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);

const USER_GROUP_ID = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';

const summary: ValueSummary = {
  provisionedPeople: 240,
  activePeople: { value: 156, previous: 139 },
  returningPeople: { value: 98, previous: 91 },
  artifacts: { value: 4012, previous: 2994 },
  putToWork: { value: 1847, previous: 1228 },
  totalCost: 12480,
  chatCost: 4200,
  remainder: {
    platform: 7000,
    workflow: 80,
    customAgent: 200,
    unattributed: 1000,
  },
  systemCost: 9900,
  costPerPutToWork: 6.7625,
  hoursInTool: 1739.6,
  hoursPerPersonPerWeek: 2.64,
  byUseCase: [
    { useCase: UseCase.ProposalCapture, cost: 2100, artifacts: 900, putToWork: 610 },
    { useCase: UseCase.PolicyCompliance, cost: 800, artifacts: 300, putToWork: 140 },
    { useCase: UseCase.ResearchAnalysis, cost: 700, artifacts: 400, putToWork: 90 },
    { useCase: UseCase.DataAnalytics, cost: 300, artifacts: 120, putToWork: 60 },
    { useCase: UseCase.Engineering, cost: 200, artifacts: 100, putToWork: 70 },
    { useCase: UseCase.WritingCommunication, cost: 60, artifacts: 40, putToWork: 12 },
    { useCase: UseCase.ProgramDelivery, cost: 30, artifacts: 20, putToWork: 8 },
    { useCase: UseCase.TrialTest, cost: 10, artifacts: 60, putToWork: 0 },
    { useCase: UseCase.Unclassified, cost: 0, artifacts: 12, putToWork: 0 },
  ],
  byTeam: [
    {
      userGroupId: USER_GROUP_ID,
      label: 'Capture Ops',
      activePeople: 12,
      members: 12,
      artifacts: 312,
      putToWork: 231,
      cost: 4148,
    },
  ],
};

const mockQuery = (overrides: Record<string, unknown>) => {
  (useGetValueSummary as jest.Mock).mockReturnValue({
    data: undefined,
    isFetching: false,
    error: null,
    ...overrides,
  });
};

const renderSection = () =>
  renderWithTheme(
    <ValueSection
      timeRange={TimeRange.Month}
      userGroupId={USER_GROUP_ID}
      userId='all'
      enabled={true}
    />,
  );

describe('ValueSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('scopes the query to the shared filter bar and honors the tab gate', () => {
    mockQuery({ data: summary });
    renderSection();

    expect(useGetValueSummary).toHaveBeenCalledWith(TimeRange.Month, USER_GROUP_ID, 'all', true);
  });

  it('renders the headline, the use-case bars, and the team table', () => {
    mockQuery({ data: summary });
    renderSection();

    expect(screen.getByTestId('value-tile-active-people')).toBeInTheDocument();
    expect(screen.getByTestId('use-case-row-proposalCapture')).toBeInTheDocument();
    expect(screen.getByTestId('team-value-section')).toBeInTheDocument();
  });

  it('renders every block in its loading state while fetching', () => {
    mockQuery({ isFetching: true });
    renderSection();

    expect(screen.getByTestId('value-headline-loading')).toBeInTheDocument();
    expect(screen.getByTestId('use-case-spend-loading')).toBeInTheDocument();
    expect(screen.getByTestId('team-value-loading')).toBeInTheDocument();
  });

  it('shows the load-failure state instead of an empty view when the query rejects', () => {
    mockQuery({ error: new Error('boom') });
    renderSection();

    expect(screen.getByTestId('studio-load-error')).toBeInTheDocument();
    expect(screen.queryByTestId('value-tile-active-people')).not.toBeInTheDocument();
  });

  it('does not show the load-failure state merely because it is still fetching', () => {
    mockQuery({ isFetching: true });
    renderSection();

    expect(screen.queryByTestId('studio-load-error')).not.toBeInTheDocument();
  });

  // The caveats moved onto the figures they qualify. This section no longer
  // renders a footnote block, and reinstating one would put the same sentences in
  // two places, free to drift apart.
  it('carries no footnote block of its own', () => {
    mockQuery({ data: summary });
    renderSection();

    expect(screen.queryByTestId('value-caveats')).not.toBeInTheDocument();
  });

  // Asserted here as well as in the child components' own tests, because the wiring
  // is what makes them reachable: a caveat attached to a tile in a component the
  // Value tab stopped rendering is a caveat nobody sees.
  it('reaches the view with every caveat attached to the figure it qualifies', () => {
    mockQuery({ data: summary });
    renderSection();

    expect(screen.getByTestId('value-tile-put-to-work').getAttribute('aria-label'))
      .toContain('downloaded, copied, or pushed to GitHub');
    expect(screen.getByTestId('value-hours-readout').getAttribute('aria-label'))
      .toContain('measured, not modeled');
    expect(screen.getByTestId('use-case-bar-unclassified').getAttribute('aria-label'))
      .toContain('could not place them');
  });

  // Not asserted as present, asserted as absent. There is no labeled ground truth
  // to measure the classifier against, so any accuracy figure on this view would
  // be fabricated — including inside a tooltip, where it would be harder to spot.
  it('claims no accuracy figure for the categories', () => {
    mockQuery({ data: summary });
    const { container } = renderSection();

    expect(container.innerHTML).not.toMatch(/accurate|accuracy|confidence/i);
  });

  it('passes the reconciliation figures through to the spend panel', () => {
    mockQuery({ data: summary });
    renderSection();

    expect(screen.getByTestId('use-case-chat-subtotal')).toHaveTextContent('$4,200.00');
    expect(screen.getByTestId('use-case-total-spend')).toHaveTextContent('$12,480.00');
    expect(screen.getByTestId('use-case-remainder-platform')).toHaveTextContent('$7,000.00');
  });

  it('never uses the word egress', () => {
    mockQuery({ data: summary });
    const { container } = renderSection();

    expect(container.textContent?.toLowerCase()).not.toContain('egress');
  });

  it('renders no drawer until a category is chosen', () => {
    mockQuery({ data: summary });
    renderSection();

    expect(screen.queryByTestId('use-case-detail-drawer')).not.toBeInTheDocument();
  });

  it('renders the drawer for the chosen category', async () => {
    mockQuery({ data: summary });
    renderSection();

    const row = screen.getByTestId('use-case-row-proposalCapture');
    await act(async () => {
      await userEvent.click(row);
    });

    expect(screen.getByTestId('use-case-detail-drawer')).toBeInTheDocument();
  });
});
