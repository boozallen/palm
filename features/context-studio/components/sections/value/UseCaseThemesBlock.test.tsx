import { render, screen } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import UseCaseThemesBlock from './UseCaseThemesBlock';
import { UseCaseThemes } from '@/features/context-studio/types/use-case-detail';
import { appTheme } from '@/providers/AppMantineProvider';

function renderWithTheme(ui: React.ReactElement) {
  return render(<MantineProvider theme={appTheme}>{ui}</MantineProvider>);
}

describe('UseCaseThemesBlock', () => {
  const mockThemes: UseCaseThemes = {
    themes: [
      { name: 'Proposal development', chats: 42, cost: 125.5 },
      { name: 'Contract review', chats: 28, cost: 89.25 },
      { name: 'Technical writing', chats: 15, cost: 45.0 },
    ],
    remainder: { chats: 15, cost: 22.75 },
    coveredChats: 85,
    analyzedChats: 100,
    truncated: false,
  };

  it('lists one line per theme with its chat count and spend', () => {
    renderWithTheme(<UseCaseThemesBlock themes={mockThemes} loading={false} failed={false} />);
    const rows = screen.getAllByTestId('use-case-theme-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveTextContent('Proposal development');
    expect(rows[0]).toHaveTextContent('42 chats');
    expect(rows[0]).toHaveTextContent('$125.50');
  });

  it('says one chat rather than 1 chats for a single-chat pursuit', () => {
    const single = { ...mockThemes, themes: [{ name: 'Harbor Authority ERP recompete', chats: 1, cost: 4.5 }] };
    renderWithTheme(<UseCaseThemesBlock themes={single} loading={false} failed={false} />);
    expect(screen.getByTestId('use-case-theme-row')).toHaveTextContent('1 chat ·');
  });

  it('accounts for the chats no theme named, under the themes', () => {
    renderWithTheme(<UseCaseThemesBlock themes={mockThemes} loading={false} failed={false} />);
    const remainder = screen.getByTestId('use-case-themes-remainder');
    expect(remainder).toHaveTextContent('Other pursuits');
    expect(remainder).toHaveTextContent('15 chats');
    expect(remainder).toHaveTextContent('$22.75');
  });

  it('shows no leftover line when every analyzed chat landed in a theme', () => {
    const allCovered: UseCaseThemes = { ...mockThemes, remainder: null };
    renderWithTheme(<UseCaseThemesBlock themes={allCovered} loading={false} failed={false} />);
    expect(screen.queryByTestId('use-case-themes-remainder')).not.toBeInTheDocument();
  });

  it('shows a skeleton while the roll-up is being computed', () => {
    renderWithTheme(<UseCaseThemesBlock themes={undefined} loading={true} failed={false} />);
    expect(screen.getByTestId('use-case-themes-loading')).toBeInTheDocument();
  });

  it('says the roll-up is unavailable rather than rendering an error when it fails', () => {
    renderWithTheme(<UseCaseThemesBlock themes={null} loading={false} failed={true} />);
    expect(screen.getByTestId('use-case-themes-unavailable')).toBeInTheDocument();
    expect(screen.getByTestId('use-case-themes-unavailable')).toHaveTextContent('themes unavailable for this period');
  });

  it('says more chats exist than were analyzed when the input was capped', () => {
    const truncatedThemes: UseCaseThemes = { ...mockThemes, truncated: true };
    renderWithTheme(<UseCaseThemesBlock themes={truncatedThemes} loading={false} failed={false} />);
    expect(screen.getByTestId('use-case-themes-truncated')).toBeInTheDocument();
  });

  it('says how many of the analyzed chats the themes cover', () => {
    renderWithTheme(<UseCaseThemesBlock themes={mockThemes} loading={false} failed={false} />);
    const coverage = screen.getByTestId('use-case-themes-coverage');
    expect(coverage).toHaveTextContent('themes cover 85 of the 100 chats analyzed');
  });
});
