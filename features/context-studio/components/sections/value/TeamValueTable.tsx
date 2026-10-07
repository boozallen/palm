import { CSSProperties } from 'react';
import { Box, Skeleton, Stack, Table, Text, useMantineTheme } from '@mantine/core';
import { IconUsersGroup } from '@tabler/icons-react';

import StudioPanel from '@/features/context-studio/components/sections/StudioPanel';
import { TeamValue } from '@/features/context-studio/types/value';
import { formatCount, formatPercent, rate } from '@/features/context-studio/utils/valueFormat';
import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';

// Four measures across named teams — a table, per the spec, not a grouped bar
// chart. Rows arrive already sorted by spend from getValueSummary; this component
// does not re-sort and does not truncate, so the column totals still reconcile
// with the headline tiles.

const NUMERIC: CSSProperties = { textAlign: 'right' };

type TeamValueTableProps = Readonly<{
  byTeam: TeamValue[];
  activePeople: number;
  loading: boolean;
}>;

// The synthetic no-team row has no membership roster, so a people column would be
// asserting '0 / 0' — which reads as a team where nobody showed up rather than as
// work that could not be attributed to a team at all.
function peopleCell(team: TeamValue): string {
  if (team.userGroupId === null) {
    return '—';
  }
  return `${formatCount(team.activePeople)} / ${formatCount(team.members)}`;
}

export default function TeamValueTable({
  byTeam,
  activePeople,
  loading,
}: TeamValueTableProps) {
  const theme = useMantineTheme();

  if (loading) {
    return (
      <Box data-testid='team-value-loading'>
        <Skeleton height={220} radius='md' />
      </Box>
    );
  }

  return (
    <Box data-testid='team-value-section'>
      <StudioPanel
        icon={<IconUsersGroup size={16} />}
        title='By team'
        hint={`${formatCount(activePeople)} active people · sorted by spend`}
        stats={[]}
      >
        <Stack spacing='sm'>
          <Table highlightOnHover>
            <thead>
              <tr>
                <th data-testid='team-header-team'>Team</th>
                <th data-testid='team-header-people' style={NUMERIC}>Active / members</th>
                <th data-testid='team-header-products' style={NUMERIC}>Work products</th>
                <th data-testid='team-header-rate' style={NUMERIC}>Put to work</th>
                <th data-testid='team-header-spend' style={NUMERIC}>Spend</th>
              </tr>
            </thead>
            <tbody>
              {byTeam.length === 0 && (
                <tr data-testid='team-table-empty'>
                  <td colSpan={5}>
                    <Text size='sm' color='dark.3'>
                      No team activity in this range.
                    </Text>
                  </td>
                </tr>
              )}
              {byTeam.map((team) => {
                const key = team.userGroupId ?? 'unattributed';
                return (
                  <tr key={key} data-testid={`team-row-${key}`}>
                    <td>
                      <Text size='sm'>{team.label}</Text>
                    </td>
                    <td style={NUMERIC} data-testid={`team-people-${key}`}>
                      <Text size='sm'>{peopleCell(team)}</Text>
                    </td>
                    <td style={NUMERIC}>
                      <Text size='sm'>{formatCount(team.artifacts)}</Text>
                    </td>
                    <td style={NUMERIC} data-testid={`team-rate-${key}`}>
                      <Text size='sm'>{formatPercent(rate(team.putToWork, team.artifacts))}</Text>
                    </td>
                    <td style={NUMERIC}>
                      <Text size='sm' sx={{ fontFamily: theme.fontFamilyMonospace }}>
                        {formatCurrencyNumberForAnalytics(team.cost)}
                      </Text>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </Stack>
      </StudioPanel>
    </Box>
  );
}
