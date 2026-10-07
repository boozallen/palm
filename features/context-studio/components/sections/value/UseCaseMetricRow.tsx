import { Grid, Stack, Text, useMantineTheme } from '@mantine/core';
import { formatCount } from '@/features/context-studio/utils/valueFormat';
import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';

const COLUMN_SPAN = 3;

type UseCaseMetricRowProps = Readonly<{
  label: string;
  chats: number;
  cost: number;
  artifacts: number;
  putToWork: number;
  testId: string;
}>;

// One labeled line of the drawer's four figures. Shared by the Who and Teams
// blocks so a column added to one cannot go missing from the other.
export default function UseCaseMetricRow({
  label,
  chats,
  cost,
  artifacts,
  putToWork,
  testId,
}: UseCaseMetricRowProps) {
  const theme = useMantineTheme();

  const columns: { label: string; value: string }[] = [
    { label: 'chats', value: formatCount(chats) },
    { label: 'spend', value: formatCurrencyNumberForAnalytics(cost) },
    { label: 'made', value: formatCount(artifacts) },
    { label: 'used', value: formatCount(putToWork) },
  ];

  return (
    <Stack spacing='xxs' data-testid={testId}>
      <Text size='sm'>{label}</Text>
      <Grid gutter='xs'>
        {columns.map((column) => (
          <Grid.Col key={column.label} span={COLUMN_SPAN}>
            <Text size='xs' c='dimmed'>
              {column.label}
            </Text>
            <Text size='sm' ff={theme.fontFamilyMonospace}>
              {column.value}
            </Text>
          </Grid.Col>
        ))}
      </Grid>
    </Stack>
  );
}
