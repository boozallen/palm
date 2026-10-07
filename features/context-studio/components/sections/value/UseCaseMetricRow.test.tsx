import { render, screen, within } from '@testing-library/react';
import { MantineProvider } from '@mantine/core';

import UseCaseMetricRow from './UseCaseMetricRow';
import { appTheme } from '@/providers/AppMantineProvider';

const renderRow = (overrides: Partial<React.ComponentProps<typeof UseCaseMetricRow>> = {}) =>
  render(
    <MantineProvider theme={appTheme}>
      <UseCaseMetricRow
        label='Dana Okoye'
        chats={12}
        cost={1234.5}
        artifacts={8}
        putToWork={3}
        testId='use-case-metric-row'
        {...overrides}
      />
    </MantineProvider>,
  );

describe('UseCaseMetricRow', () => {
  it('names the row and reports all four figures', () => {
    renderRow();

    const row = screen.getByTestId('use-case-metric-row');

    expect(row).toHaveTextContent('Dana Okoye');
    expect(row).toHaveTextContent('12');
    expect(row).toHaveTextContent('$1,234.50');
    expect(row).toHaveTextContent('8');
    expect(row).toHaveTextContent('3');
  });

  it('labels every figure so a column cannot be read as the wrong one', () => {
    renderRow();

    const row = within(screen.getByTestId('use-case-metric-row'));

    expect(row.getByText('chats')).toBeInTheDocument();
    expect(row.getByText('spend')).toBeInTheDocument();
    expect(row.getByText('made')).toBeInTheDocument();
    expect(row.getByText('used')).toBeInTheDocument();
  });

  it('carries the test id it was given, so people and team rows stay distinguishable', () => {
    renderRow({ testId: 'use-case-team-row' });

    expect(screen.getByTestId('use-case-team-row')).toBeInTheDocument();
  });
});
