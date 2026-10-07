import { render, screen } from '@testing-library/react';
import { JSX } from 'react';
import { MantineProvider } from '@mantine/core';

import ValueHeadline from './ValueHeadline';
import { ValueSummary } from '@/features/context-studio/types/value';
import { UseCase } from '@/features/shared/types/use-case';
import { appTheme } from '@/providers/AppMantineProvider';

const renderWithTheme = (ui: JSX.Element) =>
  render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);

const summary = (overrides: Partial<ValueSummary> = {}): ValueSummary => ({
  provisionedPeople: 240,
  activePeople: { value: 156, previous: 139 },
  returningPeople: { value: 98, previous: 91 },
  artifacts: { value: 4012, previous: 2994 },
  putToWork: { value: 1847, previous: 1228 },
  totalCost: 12480,
  chatCost: 12480,
  remainder: {
    platform: 0,
    workflow: 0,
    customAgent: 0,
    unattributed: 0,
  },
  systemCost: 0,
  costPerPutToWork: 6.7625,
  hoursInTool: 1739.6,
  hoursPerPersonPerWeek: 2.64,
  byUseCase: [
    { useCase: UseCase.ProposalCapture, cost: 7610, artifacts: 2100, putToWork: 1400 },
    { useCase: UseCase.PolicyCompliance, cost: 1720, artifacts: 700, putToWork: 300 },
    { useCase: UseCase.ResearchAnalysis, cost: 2150, artifacts: 900, putToWork: 120 },
    { useCase: UseCase.Unclassified, cost: 1000, artifacts: 312, putToWork: 27 },
  ],
  byTeam: [],
  ...overrides,
});

describe('ValueHeadline', () => {
  it('renders all four tiles', () => {
    renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    expect(screen.getByTestId('value-tile-active-people')).toBeInTheDocument();
    expect(screen.getByTestId('value-tile-came-back')).toBeInTheDocument();
    expect(screen.getByTestId('value-tile-work-products')).toBeInTheDocument();
    expect(screen.getByTestId('value-tile-put-to-work')).toBeInTheDocument();
  });

  it('renders active people against provisioned, with the share', () => {
    renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    const tile = screen.getByTestId('value-tile-active-people');
    expect(tile).toHaveTextContent('156 / 240');
    expect(tile).toHaveTextContent('65% of provisioned');
  });

  it('renders the put-to-work rate as that tile detail line', () => {
    renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    expect(screen.getByTestId('value-tile-put-to-work')).toHaveTextContent('46% of work products');
  });

  it('carries a percentage-point delta on the put-to-work tile, not a percent one', () => {
    renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    // 1847/4012 = 46%, 1228/2994 = 41% — five points, not twelve percent.
    expect(screen.getByTestId('value-delta-put-to-work')).toHaveTextContent('+5pts vs prior');
  });

  it('carries a percent delta on the count tiles', () => {
    renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    expect(screen.getByTestId('value-delta-work-products')).toHaveTextContent('+34% vs prior');
  });

  it('marks a decline with the down glyph', () => {
    renderWithTheme(
      <ValueHeadline
        summary={summary({ activePeople: { value: 100, previous: 125 } })}
        loading={false}
      />,
    );

    expect(screen.getByTestId('value-delta-active-people')).toHaveTextContent('▼');
    expect(screen.getByTestId('value-delta-active-people')).toHaveTextContent('-20% vs prior');
  });

  it('says there is no prior data rather than dividing by an empty period', () => {
    renderWithTheme(
      <ValueHeadline
        summary={summary({ returningPeople: { value: 12, previous: 0 } })}
        loading={false}
      />,
    );

    expect(screen.getByTestId('value-delta-came-back')).toHaveTextContent('no prior data');
  });

  it('renders spend and the unit cost', () => {
    renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    const readout = screen.getByTestId('value-spend-readout');
    expect(readout).toHaveTextContent('$12,480.00 spent');
    expect(readout).toHaveTextContent('$6.76 per work product put to work');
  });

  it('renders an em dash for the unit cost when nothing was put to work', () => {
    renderWithTheme(
      <ValueHeadline
        summary={summary({ putToWork: { value: 0, previous: 0 }, costPerPutToWork: null })}
        loading={false}
      />,
    );

    expect(screen.getByTestId('value-spend-readout')).toHaveTextContent('— per work product put to work');
  });

  it('renders measured hours in tool and the weekly rate', () => {
    renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    const readout = screen.getByTestId('value-hours-readout');
    expect(readout).toHaveTextContent('1,740 hrs in tool');
    expect(readout).toHaveTextContent('2.6 hrs/person/wk');
  });

  // These qualifications used to sit in a seven-line block under the whole view,
  // where the reader had to work out which number each one applied to. Asserted on
  // aria-label rather than on the tooltip popover: the label is what exists before
  // a hover, and it is what a screen reader gets.
  it('defines what put to work counts on that tile', () => {
    renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    expect(screen.getByTestId('value-tile-put-to-work').getAttribute('aria-label'))
      .toBe('A work product counts as put to work once it has been downloaded, copied, or pushed to GitHub.');
  });

  // The tooltips that survive define a metric. The tiles whose figure needs no
  // definition carry none, so a reader is never invited to hover over a number
  // that has nothing further to say.
  it('leaves the tiles that need no definition unqualified', () => {
    renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    expect(screen.getByTestId('value-tile-active-people')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('value-tile-came-back')).not.toHaveAttribute('aria-label');
    expect(screen.getByTestId('value-tile-work-products')).not.toHaveAttribute('aria-label');
  });

  it('qualifies the hours readout as measured rather than modeled', () => {
    renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    expect(screen.getByTestId('value-hours-readout').getAttribute('aria-label'))
      .toContain('measured, not modeled');
  });

  // Not asserted as present, asserted as absent. There is no labeled ground truth
  // to measure any of these figures against, so an accuracy claim would be
  // fabricated — including inside a tooltip, where it would be harder to spot.
  it('claims no accuracy figure anywhere, tooltips included', () => {
    const { container } = renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    expect(container.innerHTML).not.toMatch(/accurate|accuracy|confidence/i);
  });

  it('renders skeletons while loading', () => {
    renderWithTheme(<ValueHeadline summary={undefined} loading={true} />);

    expect(screen.getByTestId('value-headline-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('value-tile-active-people')).not.toBeInTheDocument();
  });

  it('never uses the word egress', () => {
    const { container } = renderWithTheme(<ValueHeadline summary={summary()} loading={false} />);

    expect(container.textContent?.toLowerCase()).not.toContain('egress');
  });
});
