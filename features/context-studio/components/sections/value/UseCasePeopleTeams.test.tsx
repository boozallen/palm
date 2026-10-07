import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';
import UseCasePeopleTeams from './UseCasePeopleTeams';
import { UseCasePersonRow, UseCaseTeamRow } from '@/features/context-studio/types/use-case-detail';
import { appTheme } from '@/providers/AppMantineProvider';

const renderWithTheme = (ui: React.ReactElement) => {
  return render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);
};

describe('UseCasePeopleTeams', () => {
  const mockPeople: UseCasePersonRow[] = [
    {
      userId: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
      chats: 10,
      cost: 100,
      artifacts: 5,
      putToWork: 3,
    },
    {
      userId: 'user-2',
      name: 'Bob',
      email: 'bob@example.com',
      chats: 8,
      cost: 80,
      artifacts: 4,
      putToWork: 2,
    },
  ];

  const mockTeams: UseCaseTeamRow[] = [
    {
      userGroupId: 'group-1',
      label: 'Engineering',
      chats: 20,
      cost: 200,
      artifacts: 10,
      putToWork: 6,
    },
    {
      userGroupId: 'group-2',
      label: 'Product',
      chats: 15,
      cost: 150,
      artifacts: 8,
      putToWork: 5,
    },
  ];

  it('lists the top people by spend', () => {
    renderWithTheme(<UseCasePeopleTeams people={mockPeople} teams={mockTeams} />);
    const personRows = screen.getAllByTestId('use-case-person-row');
    expect(personRows.length).toBe(2);
  });

  it('lists the top teams by spend', () => {
    renderWithTheme(<UseCasePeopleTeams people={mockPeople} teams={mockTeams} />);
    const teamRows = screen.getAllByTestId('use-case-team-row');
    expect(teamRows.length).toBe(2);
  });

  it('falls back to the email when a person has no name', () => {
    const peopleWithoutName: UseCasePersonRow[] = [
      {
        userId: 'user-1',
        name: null,
        email: 'user@example.com',
        chats: 10,
        cost: 100,
        artifacts: 5,
        putToWork: 3,
      },
    ];
    renderWithTheme(<UseCasePeopleTeams people={peopleWithoutName} teams={mockTeams} />);
    expect(screen.getByText('user@example.com')).toBeInTheDocument();
  });

  it('shows the top five and no more', () => {
    const eightPeople: UseCasePersonRow[] = Array.from({ length: 8 }, (_, i) => ({
      userId: `user-${i}`,
      name: `Person ${i}`,
      email: `person${i}@example.com`,
      chats: 10 - i,
      cost: 100 - i * 10,
      artifacts: 5,
      putToWork: 3,
    }));
    renderWithTheme(<UseCasePeopleTeams people={eightPeople} teams={mockTeams} />);
    const personRows = screen.getAllByTestId('use-case-person-row');
    expect(personRows.length).toBe(5);
  });
});
