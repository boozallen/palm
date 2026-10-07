import { render, screen } from '@testing-library/react';

import TeamValueTable from './TeamValueTable';
import { TeamValue } from '@/features/context-studio/types/value';

const CAPTURE_ID = '7b91f044-da78-43d4-91aa-5fbeffcb3e76';
const GROWTH_ID = 'c3a1e0d2-5f47-4f0b-9c1e-2b8a6d4f1e90';

const byTeam: TeamValue[] = [
  {
    userGroupId: CAPTURE_ID,
    label: 'Capture Ops',
    activePeople: 12,
    members: 12,
    artifacts: 312,
    putToWork: 231,
    cost: 4148,
  },
  {
    userGroupId: GROWTH_ID,
    label: 'Growth Team',
    activePeople: 8,
    members: 11,
    artifacts: 198,
    putToWork: 101,
    cost: 2810,
  },
  {
    userGroupId: null,
    label: 'Unattributed (no team)',
    activePeople: 0,
    members: 0,
    artifacts: 94,
    putToWork: 21,
    cost: 1004,
  },
];

describe('TeamValueTable', () => {
  it('renders one row per team, in the order given', () => {
    render(
      <TeamValueTable byTeam={byTeam} activePeople={18} loading={false} />,
    );

    const rows = screen.getAllByTestId(/^team-row-/);
    expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
      `team-row-${CAPTURE_ID}`,
      `team-row-${GROWTH_ID}`,
      'team-row-unattributed',
    ]);
  });

  it('renders active people over members', () => {
    render(
      <TeamValueTable byTeam={byTeam} activePeople={18} loading={false} />,
    );

    expect(screen.getByTestId(`team-row-${GROWTH_ID}`)).toHaveTextContent('8 / 11');
  });

  it('renders an em dash for the unattributed row instead of 0 / 0', () => {
    render(
      <TeamValueTable byTeam={byTeam} activePeople={18} loading={false} />,
    );

    expect(screen.getByTestId('team-people-unattributed')).toHaveTextContent('—');
  });

  it('renders the put-to-work rate and the spend for each team', () => {
    render(
      <TeamValueTable byTeam={byTeam} activePeople={18} loading={false} />,
    );

    const row = screen.getByTestId(`team-row-${CAPTURE_ID}`);
    expect(row).toHaveTextContent('312');
    expect(row).toHaveTextContent('74%');
    expect(row).toHaveTextContent('$4,148.00');
  });

  it('renders an em dash for the rate of a team with no work products', () => {
    render(
      <TeamValueTable
        byTeam={[{ ...byTeam[0], artifacts: 0, putToWork: 0 }]}
        activePeople={18}
        loading={false}
      />,
    );

    expect(screen.getByTestId(`team-rate-${CAPTURE_ID}`)).toHaveTextContent('—');
  });

  it('reports the distinct active count, not the sum of the rows', () => {
    render(
      <TeamValueTable byTeam={byTeam} activePeople={18} loading={false} />,
    );

    // The rows carry 12 + 8 + 0 = 20; the distinct count is 18.
    expect(screen.getByTestId('team-value-section')).toHaveTextContent('18 active people');
  });

  it('renders an empty state rather than a headed table with no rows', () => {
    render(
      <TeamValueTable byTeam={[]} activePeople={0} loading={false} />,
    );

    expect(screen.getByTestId('team-table-empty')).toBeInTheDocument();
    expect(screen.queryByTestId(/^team-row-/)).not.toBeInTheDocument();
  });

  it('renders a skeleton while loading', () => {
    render(
      <TeamValueTable byTeam={[]} activePeople={0} loading={true} />,
    );

    expect(screen.getByTestId('team-value-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('team-table-empty')).not.toBeInTheDocument();
  });

  it('never uses the word egress', () => {
    const { container } = render(
      <TeamValueTable byTeam={byTeam} activePeople={18} loading={false} />,
    );

    expect(container.textContent?.toLowerCase()).not.toContain('egress');
  });
});
