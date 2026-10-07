import { Grid, Stack, Text, useMantineTheme } from '@mantine/core';
import UseCaseMetricRow from './UseCaseMetricRow';
import { UseCasePersonRow, UseCaseTeamRow } from '@/features/context-studio/types/use-case-detail';

const TOP_ROWS = 5;
const UNKNOWN_PERSON = 'Unknown';

type UseCasePeopleTeamsProps = Readonly<{
  people: UseCasePersonRow[];
  teams: UseCaseTeamRow[];
}>;

export default function UseCasePeopleTeams({ people, teams }: UseCasePeopleTeamsProps) {
  const theme = useMantineTheme();
  const topPeople = people.slice(0, TOP_ROWS);
  const topTeams = teams.slice(0, TOP_ROWS);

  const heading = (text: string) => (
    <Text size='xs' weight={theme.other.fontWeights.medium} c='gray.5' tt='uppercase'>
      {text}
    </Text>
  );

  return (
    <Grid>
      <Grid.Col span={6}>
        <Stack spacing='xs'>
          {heading('Who')}
          {topPeople.map((person) => (
            <UseCaseMetricRow
              key={person.userId}
              label={person.name ?? person.email ?? UNKNOWN_PERSON}
              chats={person.chats}
              cost={person.cost}
              artifacts={person.artifacts}
              putToWork={person.putToWork}
              testId='use-case-person-row'
            />
          ))}
        </Stack>
      </Grid.Col>

      <Grid.Col span={6}>
        <Stack spacing='xs'>
          {heading('Teams')}
          {topTeams.map((team) => (
            <UseCaseMetricRow
              key={team.userGroupId ?? team.label}
              label={team.label}
              chats={team.chats}
              cost={team.cost}
              artifacts={team.artifacts}
              putToWork={team.putToWork}
              testId='use-case-team-row'
            />
          ))}
        </Stack>
      </Grid.Col>
    </Grid>
  );
}
