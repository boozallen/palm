import { Grid, Group, Paper, Skeleton, Stack, Text, Tooltip, useMantineTheme } from '@mantine/core';

import { ValueSummary } from '@/features/context-studio/types/value';
import {
  DeltaDirection,
  DeltaReadout,
  formatCount,
  formatHours,
  formatHoursPerPerson,
  formatPercent,
  formatUnitCost,
  percentDelta,
  pointsDelta,
  rate,
} from '@/features/context-studio/utils/valueFormat';
import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';

// The top of the Value view: four stat tiles and the spend/hours readout under
// them. Stat tiles rather than charts on purpose — each of these has exactly one
// number to say, and a plot of one number is decoration.
//
// Direction is carried by a glyph as well as a colour, so the trend is readable
// without colour vision.
const DELTA_STYLE: Record<DeltaDirection, { glyph: string; color: string }> = {
  up: { glyph: '▲', color: 'teal.4' },
  down: { glyph: '▼', color: 'red.4' },
  flat: { glyph: '–', color: 'dark.3' },
};

// Matches the hero-number size already used by UserActivityChart in this feature.
const HERO_SIZE = 32;

// Wide enough for two sentences at this font size without becoming a paragraph
// the reader has to hunt through.
const TOOLTIP_WIDTH = 360;

// The qualifications that used to sit in a seven-line block under the whole view,
// each moved onto the number it qualifies. A caveat a reader has to match up to a
// figure themselves is a caveat that gets skipped; one attached to the figure is
// there at the moment the figure is questioned.
//
// Only the two that answer "what does this number count". The rest were cut on
// review: a tooltip earns its place by defining a metric, not by listing every
// way the metric could be misread.
const PUT_TO_WORK_CAVEAT =
  'A work product counts as put to work once it has been downloaded, copied, or ' +
  'pushed to GitHub.';

const HOURS_CAVEAT =
  'Hours in tool are measured, not modeled. No hours-saved figure is shown, ' +
  'because there is no defensible way to derive one from this data.';

type ValueTileProps = Readonly<{
  testId: string;
  deltaTestId: string;
  label: string;
  value: string;
  detail: string;
  delta: DeltaReadout;
  caveat?: string;
}>;

function ValueTile({ testId, deltaTestId, label, value, detail, delta, caveat }: ValueTileProps) {
  const theme = useMantineTheme();
  const style = DELTA_STYLE[delta.direction];

  // aria-label as well as the tooltip: a tooltip exists only after a hover, and
  // the qualification has to reach a reader who never hovers.
  const tile = (
    <Paper
      radius='md'
      bg='dark.7'
      p='md'
      data-testid={testId}
      aria-label={caveat}
      sx={{ border: `1px solid ${theme.colors.dark[6]}`, height: '100%' }}
    >
      <Stack spacing='xxs'>
        <Text size='xxs' color='dark.3' tt='uppercase' weight={theme.other.fontWeights.bold}>
          {label}
        </Text>
        <Text size={HERO_SIZE} weight={theme.other.fontWeights.bold} sx={{ lineHeight: 1 }}>
          {value}
        </Text>
        <Text size='xs' color='dark.3'>
          {detail}
        </Text>
        <Group spacing='xs' noWrap data-testid={deltaTestId}>
          <Text size='xs' color={style.color} aria-hidden='true'>
            {style.glyph}
          </Text>
          <Text size='xs' color={style.color}>
            {delta.text}
          </Text>
        </Group>
      </Stack>
    </Paper>
  );

  if (caveat === undefined) {
    return tile;
  }

  return (
    <Tooltip label={caveat} multiline width={TOOLTIP_WIDTH} withinPortal>
      {tile}
    </Tooltip>
  );
}

type ValueHeadlineProps = Readonly<{
  summary: ValueSummary | undefined;
  loading: boolean;
}>;

export default function ValueHeadline({ summary, loading }: ValueHeadlineProps) {
  const theme = useMantineTheme();

  // `summary` is undefined while loading and for the brief window before the
  // first fetch resolves. The failure state is ValueSection's job, not this
  // component's — it never renders an error of its own.
  if (loading || !summary) {
    return (
      <Grid data-testid='value-headline-loading'>
        {[0, 1, 2, 3].map((slot) => (
          <Grid.Col span={3} key={slot}>
            <Skeleton height={128} radius='md' />
          </Grid.Col>
        ))}
        <Grid.Col span={12}>
          <Skeleton height={48} radius='md' />
        </Grid.Col>
      </Grid>
    );
  }

  const putToWorkRate = rate(summary.putToWork.value, summary.artifacts.value);
  const priorPutToWorkRate = rate(summary.putToWork.previous, summary.artifacts.previous);

  return (
    <Stack spacing='md'>
      <Grid>
        <Grid.Col span={3}>
          <ValueTile
            testId='value-tile-active-people'
            deltaTestId='value-delta-active-people'
            label='Active people'
            value={`${formatCount(summary.activePeople.value)} / ${formatCount(summary.provisionedPeople)}`}
            detail={`${formatPercent(rate(summary.activePeople.value, summary.provisionedPeople))} of provisioned`}
            delta={percentDelta(summary.activePeople.value, summary.activePeople.previous)}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <ValueTile
            testId='value-tile-came-back'
            deltaTestId='value-delta-came-back'
            label='Came back'
            value={formatCount(summary.returningPeople.value)}
            detail='Active in 3+ separate weeks'
            delta={percentDelta(summary.returningPeople.value, summary.returningPeople.previous)}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <ValueTile
            testId='value-tile-work-products'
            deltaTestId='value-delta-work-products'
            label='Work products'
            value={formatCount(summary.artifacts.value)}
            detail='Created in this period'
            delta={percentDelta(summary.artifacts.value, summary.artifacts.previous)}
          />
        </Grid.Col>
        <Grid.Col span={3}>
          <ValueTile
            testId='value-tile-put-to-work'
            deltaTestId='value-delta-put-to-work'
            label='Put to work'
            value={formatCount(summary.putToWork.value)}
            detail={`${formatPercent(putToWorkRate)} of work products`}
            delta={pointsDelta(putToWorkRate, priorPutToWorkRate)}
            caveat={PUT_TO_WORK_CAVEAT}
          />
        </Grid.Col>
      </Grid>

      <Paper
        radius='md'
        bg='dark.7'
        p='md'
        sx={{ border: `1px solid ${theme.colors.dark[6]}` }}
      >
        <Stack spacing='xxs'>
          <Text size='sm' data-testid='value-spend-readout'>
            {`${formatCurrencyNumberForAnalytics(summary.totalCost)} spent`}
            <Text component='span' color='dark.3'>{' · '}</Text>
            {`${formatUnitCost(summary.costPerPutToWork)} per work product put to work`}
          </Text>
          <Tooltip label={HOURS_CAVEAT} multiline width={TOOLTIP_WIDTH} withinPortal>
            <Text
              size='sm'
              color='dark.3'
              data-testid='value-hours-readout'
              aria-label={HOURS_CAVEAT}
            >
              {`${formatHours(summary.hoursInTool)} hrs in tool`}
              {' · '}
              {`${formatHoursPerPerson(summary.hoursPerPersonPerWeek)} hrs/person/wk`}
            </Text>
          </Tooltip>
        </Stack>
      </Paper>
    </Stack>
  );
}
