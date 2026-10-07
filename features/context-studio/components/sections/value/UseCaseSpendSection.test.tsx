import { MantineProvider } from '@mantine/core';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { JSX } from 'react';

import { SpendRemainder, UseCaseSpend } from '@/features/context-studio/types/value';
import { UseCase } from '@/features/shared/types/use-case';
import { appTheme } from '@/providers/AppMantineProvider';

import UseCaseSpendSection from './UseCaseSpendSection';

const renderWithTheme = (ui: JSX.Element) =>
  render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);

// 200 + 100 + 50 + 0 = 350 chat spend, largest bucket 200, so bar widths are
// 100 / 50 / 25 / 0 percent and shares of chat spend are 57 / 29 / 14 / 0.
const byUseCase: UseCaseSpend[] = [
  { useCase: UseCase.ProposalCapture, cost: 200, artifacts: 18, putToWork: 14 },
  { useCase: UseCase.PolicyCompliance, cost: 100, artifacts: 9, putToWork: 5 },
  { useCase: UseCase.ResearchAnalysis, cost: 50, artifacts: 11, putToWork: 0 },
  { useCase: UseCase.TrialTest, cost: 0, artifacts: 12, putToWork: 0 },
];

const remainder: SpendRemainder = {
  platform: 4000,
  workflow: 10,
  customAgent: 40,
  unattributed: 100,
};

const CHAT_COST = 350;
const TOTAL_COST = 4500;
const SYSTEM_COST = 5751;

const renderSection = (overrides: Partial<{
  byUseCase: UseCaseSpend[];
  chatCost: number;
  remainder: SpendRemainder;
  totalCost: number;
  systemCost: number;
  loading: boolean;
}> = {}) =>
  renderWithTheme(
    <UseCaseSpendSection
      byUseCase={overrides.byUseCase ?? byUseCase}
      chatCost={overrides.chatCost ?? CHAT_COST}
      remainder={overrides.remainder ?? remainder}
      totalCost={overrides.totalCost ?? TOTAL_COST}
      systemCost={overrides.systemCost ?? SYSTEM_COST}
      loading={overrides.loading ?? false}
    />,
  );

describe('UseCaseSpendSection', () => {
  it('renders all nine categories in fixed order, including those absent from the data', () => {
    renderSection();

    const rows = screen.getAllByTestId(/^use-case-row-/);
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      'use-case-row-proposalCapture',
      'use-case-row-policyCompliance',
      'use-case-row-researchAnalysis',
      'use-case-row-dataAnalytics',
      'use-case-row-engineering',
      'use-case-row-writingCommunication',
      'use-case-row-programDelivery',
      'use-case-row-trialTest',
      'use-case-row-unclassified',
    ]);
  });

  it('keeps taxonomy order even when the input arrives sorted by value', () => {
    renderSection({ byUseCase: [...byUseCase].reverse() });

    const rows = screen.getAllByTestId(/^use-case-row-/);
    expect(rows[0].getAttribute('data-testid')).toBe('use-case-row-proposalCapture');
    expect(rows[8].getAttribute('data-testid')).toBe('use-case-row-unclassified');
  });

  it('scales bar widths against the largest category, not the total', () => {
    renderSection();

    expect(screen.getByTestId('use-case-bar-proposalCapture')).toHaveStyle({ width: '100.0%' });
    expect(screen.getByTestId('use-case-bar-policyCompliance')).toHaveStyle({ width: '50.0%' });
    expect(screen.getByTestId('use-case-bar-researchAnalysis')).toHaveStyle({ width: '25.0%' });
  });

  // Bar widths are percentages, so a track that does not fill the row renders
  // all nine bars at zero width. Group's `& > *` rule beats an sx class, which
  // is why the growth is inline and why this asserts the attribute.
  it('gives the bars a full-width track to be a percentage of', () => {
    renderSection();

    const track = screen.getByTestId('use-case-bar-proposalCapture').parentElement;
    expect(track).toHaveAttribute('style', expect.stringContaining('flex-grow: 1'));
  });

  // Share is of chat spend, not of total spend. Against the total, every bar on
  // today's data would read 1-4% and the panel would say nothing.
  it('takes each share against chat spend rather than total spend', () => {
    renderSection();

    expect(screen.getByTestId('use-case-row-proposalCapture')).toHaveTextContent('57%');
    expect(screen.getByTestId('use-case-row-policyCompliance')).toHaveTextContent('29%');
  });

  it('renders made, used and cost-per-used for every category', () => {
    renderSection();

    expect(screen.getByTestId('use-case-made-proposalCapture')).toHaveTextContent('18');
    expect(screen.getByTestId('use-case-used-proposalCapture')).toHaveTextContent('14');
    expect(screen.getByTestId('use-case-unit-cost-proposalCapture')).toHaveTextContent('$14.29');
  });

  // A zero here would assert a unit cost that does not exist. Research & analysis
  // at 0-of-11 and Trial & test at 0-of-12 are the two findings the previous panel
  // could not express at all, and a fabricated $0.00 would bury both.
  it('renders a dash, never a number, when nothing in a category was put to work', () => {
    renderSection();

    expect(screen.getByTestId('use-case-unit-cost-researchAnalysis')).toHaveTextContent('—');
    expect(screen.getByTestId('use-case-unit-cost-trialTest')).toHaveTextContent('—');
  });

  it('labels the value columns', () => {
    renderSection();

    const header = screen.getByTestId('use-case-columns-header');
    expect(header).toHaveTextContent('made');
    expect(header).toHaveTextContent('used');
  });

  it('names every remainder line and subtotals it', () => {
    renderSection();

    expect(screen.getByTestId('use-case-remainder-platform')).toHaveTextContent('$4,000.00');
    expect(screen.getByTestId('use-case-remainder-customAgent')).toHaveTextContent('$40.00');
    expect(screen.getByTestId('use-case-remainder-workflow')).toHaveTextContent('$10.00');
  });

  // Every other footer line names an activity somebody chose to run. This bucket names
  // a measurement gap — chats nothing classified, plus callers that supplied no
  // attribution — and giving it a line of its own put a number meaning "not known"
  // alongside document indexing as though the two were comparable findings.
  it('does not itemize unattributed spend as though it were an activity', () => {
    renderSection();

    expect(screen.queryByTestId('use-case-remainder-unattributed')).not.toBeInTheDocument();
  });

  // The reader's question is "what is the big one", and on today's data the big
  // one is document indexing at eleven times the entire categorized total. Sorting
  // by conceptual tidiness would bury that.
  it('orders the remainder lines largest first', () => {
    renderSection();

    const lines = screen.getAllByTestId(/^use-case-remainder-/);
    expect(lines.map((line) => line.getAttribute('data-testid'))).toEqual([
      'use-case-remainder-platform',
      'use-case-remainder-customAgent',
      'use-case-remainder-workflow',
    ]);
  });

  // The total is the real total, not a sum of what is rendered. $4,500 is passed while
  // the visible lines plus the bars come to $4,400 — the missing $100 is unattributed
  // spend, counted but no longer named. A version that summed the visible rows instead
  // would drop it and under-report what the platform actually cost.
  it('shows total spend rather than a sum of the lines it renders', () => {
    renderSection();

    expect(screen.getByTestId('use-case-total-spend')).toHaveTextContent('$4,500.00');
  });

  // The three lines are a highlight, not a reconciliation, because unattributed spend
  // is deliberately absent from them. Claiming to list everything would make the total
  // above look wrong to anyone who added the column up.
  it('presents the outside-chat lines as the largest rather than as all of them', () => {
    renderSection();

    const footer = screen.getByTestId('use-case-reconciliation');
    expect(footer).toHaveTextContent('Largest spend outside chat');
    expect(footer).not.toHaveTextContent('Not categorized here');
  });

  it('names system spend as a note rather than folding it into the total', () => {
    renderSection();

    expect(screen.getByTestId('use-case-system-note')).toHaveTextContent('$5,751.00');
    expect(screen.getByTestId('use-case-total-spend')).not.toHaveTextContent('$5,751.00');
  });

  // A "plus $0.00 system spend" line reads as a broken figure rather than as an
  // absence, and on a quiet period or a scope with no system calls it is every bit of
  // the panel's last line.
  it('drops the system spend note when there is none', () => {
    renderSection({ systemCost: 0 });

    expect(screen.queryByTestId('use-case-system-note')).not.toBeInTheDocument();
  });

  it('paints Unclassified neutral gray rather than a hue', () => {
    renderSection();

    expect(screen.getByTestId('use-case-bar-unclassified'))
      .toHaveStyle({ backgroundColor: '#6c6f75' });
  });

  // Colour stopped being an identity channel when the palette collapsed to one
  // accent, which is what makes the direct labels load-bearing rather than
  // decorative.
  it('paints every substantive category the same accent', () => {
    renderSection();

    expect(screen.getByTestId('use-case-bar-proposalCapture'))
      .toHaveStyle({ backgroundColor: '#3987e5' });
    expect(screen.getByTestId('use-case-bar-engineering'))
      .toHaveStyle({ backgroundColor: '#3987e5' });
  });

  it('direct-labels every bar with its category, dollars and share', () => {
    renderSection();

    expect(screen.getByTestId('use-case-bar-policyCompliance')).toHaveAttribute(
      'aria-label',
      'Policy, compliance & risk: $100.00, 29% of chat spend, 9 work products made, 5 put to work',
    );
  });

  // This row is a finding, not a leftover. Unclassified means the classifier read
  // the conversation and could not place it; a chat it never read — one predating
  // categorization, or whose summary call failed — is not counted here at all. The
  // earlier wording said the opposite, and a reader who trusted it would have taken
  // this row as the pre-feature backlog.
  it('states on the Unclassified row that it read these chats and could not place them', () => {
    renderSection();

    const caveat = screen.getByTestId('use-case-bar-unclassified').getAttribute('aria-label');
    expect(caveat).toContain('could not place them');
    expect(caveat).toContain('never read are not counted');
  });

  it('leaves that explanation off the categories it does not apply to', () => {
    renderSection();

    expect(screen.getByTestId('use-case-bar-proposalCapture').getAttribute('aria-label'))
      .not.toContain('could not place them');
  });

  it('survives a period with no spend at all', () => {
    renderSection({
      byUseCase: [],
      chatCost: 0,
      totalCost: 0,
      systemCost: 0,
      remainder: { platform: 0, workflow: 0, customAgent: 0, unattributed: 0 },
    });

    expect(screen.getAllByTestId(/^use-case-row-/)).toHaveLength(9);
    expect(screen.getByTestId('use-case-chat-subtotal')).toHaveTextContent('$0.00');
    expect(screen.getByTestId('use-case-unit-cost-proposalCapture')).toHaveTextContent('—');
  });

  it('renders skeletons while loading', () => {
    renderSection({ loading: true });

    expect(screen.getByTestId('use-case-spend-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('use-case-row-proposalCapture')).not.toBeInTheDocument();
    expect(screen.queryByTestId('use-case-reconciliation')).not.toBeInTheDocument();
  });

  it('never uses the word egress', () => {
    const { container } = renderSection();

    expect(container.textContent?.toLowerCase()).not.toContain('egress');
  });

  it('opens the drawer for the clicked category', async () => {
    const onSelectUseCase = jest.fn();
    renderWithTheme(
      <UseCaseSpendSection
        byUseCase={byUseCase}
        chatCost={CHAT_COST}
        remainder={remainder}
        totalCost={TOTAL_COST}
        systemCost={SYSTEM_COST}
        loading={false}
        onSelectUseCase={onSelectUseCase}
      />,
    );

    const row = screen.getByTestId('use-case-row-proposalCapture');
    await userEvent.click(row);

    expect(onSelectUseCase).toHaveBeenCalledWith(UseCase.ProposalCapture);
  });

  it('opens the drawer from the keyboard', () => {
    const onSelectUseCase = jest.fn();
    renderWithTheme(
      <UseCaseSpendSection
        byUseCase={byUseCase}
        chatCost={CHAT_COST}
        remainder={remainder}
        totalCost={TOTAL_COST}
        systemCost={SYSTEM_COST}
        loading={false}
        onSelectUseCase={onSelectUseCase}
      />,
    );

    const row = screen.getByTestId('use-case-row-proposalCapture');
    row.focus();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(onSelectUseCase).toHaveBeenCalledWith(UseCase.ProposalCapture);

    onSelectUseCase.mockClear();
    const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });
    const preventDefaultSpy = jest.spyOn(spaceEvent, 'preventDefault');
    row.dispatchEvent(spaceEvent);
    expect(onSelectUseCase).toHaveBeenCalledWith(UseCase.ProposalCapture);
    expect(preventDefaultSpy).toHaveBeenCalled();
  });

  it('does not open a category with nothing in the period', async () => {
    const onSelectUseCase = jest.fn();
    renderWithTheme(
      <UseCaseSpendSection
        byUseCase={byUseCase}
        chatCost={CHAT_COST}
        remainder={remainder}
        totalCost={TOTAL_COST}
        systemCost={SYSTEM_COST}
        loading={false}
        onSelectUseCase={onSelectUseCase}
      />,
    );

    const row = screen.getByTestId('use-case-row-engineering');
    await userEvent.click(row);

    expect(onSelectUseCase).not.toHaveBeenCalled();
  });

  it('leaves the rows inert when the drill-down is off', () => {
    renderWithTheme(
      <UseCaseSpendSection
        byUseCase={byUseCase}
        chatCost={CHAT_COST}
        remainder={remainder}
        totalCost={TOTAL_COST}
        systemCost={SYSTEM_COST}
        loading={false}
      />,
    );

    const row = screen.getByTestId('use-case-row-proposalCapture');
    expect(row).not.toHaveAttribute('role', 'button');
  });

  it('opens the Unclassified row like any other', () => {
    const onSelectUseCase = jest.fn();
    const withUnclassified: UseCaseSpend[] = [
      ...byUseCase,
      { useCase: UseCase.Unclassified, cost: 25, artifacts: 3, putToWork: 1 },
    ];
    renderWithTheme(
      <UseCaseSpendSection
        byUseCase={withUnclassified}
        chatCost={CHAT_COST + 25}
        remainder={remainder}
        totalCost={TOTAL_COST + 25}
        systemCost={SYSTEM_COST}
        loading={false}
        onSelectUseCase={onSelectUseCase}
      />,
    );

    const row = screen.getByTestId('use-case-row-unclassified');
    row.click();

    expect(onSelectUseCase).toHaveBeenCalledWith(UseCase.Unclassified);
  });
});
