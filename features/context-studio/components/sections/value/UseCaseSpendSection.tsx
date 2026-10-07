import React from 'react';
import { Box, Divider, Group, Skeleton, Stack, Text, Tooltip, useMantineTheme } from '@mantine/core';
import { IconTargetArrow } from '@tabler/icons-react';

import StudioPanel from '@/features/context-studio/components/sections/StudioPanel';
import {
  SpendRemainder,
  USE_CASE_COLORS,
  UseCaseSpend,
} from '@/features/context-studio/types/value';
import { formatCount, formatPercent, formatUnitCost, rate } from '@/features/context-studio/utils/valueFormat';
import { UseCase, USE_CASE_LABELS, USE_CASE_ORDER } from '@/features/shared/types/use-case';
import { formatCurrencyNumberForAnalytics } from '@/features/shared/utils';

// Spend split by what people were doing in chat, with the value each category
// produced beside it. Bars are scaled against the largest category so the small
// ones stay legible; the share beside each bar is the share of CATEGORIZED chat
// spend, which is what the bars sum to and what the subtotal row names. Against
// total spend every bar would read 1-4% and the panel would say nothing.
//
// USE_CASE_COLORS is one accent for eight categories and gray for Unclassified,
// so colour carries no identity at all here — the direct label is the ONLY thing
// telling one bar from another. Removing a label to save width does not degrade
// this panel, it breaks it.
//
// The footer is not a footnote. Bars cover chat only, and on today's data chat is
// 8% of non-system spend while document indexing is 88% — so the remainder reads
// about eleven times larger than everything above it. That imbalance is a fact
// about the product, not a layout problem to style away.

// What Unclassified counts, and what it deliberately does not. This row is only
// conversations the classifier read and could not place. A chat it never read at
// all — one predating categorization, or whose summary call failed — has no finding
// to report and is absorbed unnamed into the total instead. Without that split
// this row would open at the entire pre-feature history and read as a broken panel
// rather than as a measurement.
const UNCLASSIFIED_CAVEAT =
  'The classifier read these conversations but could not place them in a category. ' +
  'Chats it never read are not counted here.';

const LABEL_WIDTH = 148;
const BAR_HEIGHT = 14;
const TOOLTIP_WIDTH = 360;
const COST_WIDTH = 88;
const SHARE_WIDTH = 44;
const COUNT_WIDTH = 44;
const UNIT_COST_WIDTH = 76;

// Every remainder line names an activity somebody chose to run, which is what makes
// it worth a reader's attention. `unattributed` is deliberately absent: it is the one
// bucket that names no activity — half of it is chats nothing ever classified, half is
// internal callers that supplied no attribution — so itemizing it gave a measurement
// gap the same billing as document indexing. It is still counted, inside the total
// spend line below, which is where a number that means "not known" belongs — present
// in the figure the Cost tab has to agree with, but not itemized as a finding.
type RemainderLine = Exclude<keyof SpendRemainder, 'unattributed'>;

const REMAINDER_LABELS: Record<RemainderLine, string> = {
  platform: 'Platform (document indexing, embeddings, graph)',
  customAgent: 'Custom agent runs (PRISM, CERTA, and the rest)',
  workflow: 'Workflow runs',
};

const REMAINDER_KEYS: RemainderLine[] = [
  'platform',
  'workflow',
  'customAgent',
];

type UseCaseSpendSectionProps = Readonly<{
  byUseCase: UseCaseSpend[];
  chatCost: number;
  remainder: SpendRemainder;
  totalCost: number;
  systemCost: number;
  loading: boolean;
  onSelectUseCase?: (useCase: UseCase) => void;
}>;

type RowProps = Readonly<{
  useCase: UseCase;
  cost: number;
  artifacts: number;
  putToWork: number;
  chatCost: number;
  maxCost: number;
  onSelect?: (useCase: UseCase) => void;
}>;

function UseCaseRow({ useCase, cost, artifacts, putToWork, chatCost, maxCost, onSelect }: RowProps) {
  const theme = useMantineTheme();
  const label = USE_CASE_LABELS[useCase];
  const share = rate(cost, chatCost);
  // toFixed(1) rather than a raw float: the width lands in a style attribute, and
  // a 14-digit percentage is unassertable in a test and unreadable in devtools.
  const width = `${(maxCost > 0 ? (cost / maxCost) * 100 : 0).toFixed(1)}%`;
  // Appended only to Unclassified. The other eight rows are a category the reader
  // asked for; Unclassified is the one that prompts "why is this here at all".
  const caveat = useCase === UseCase.Unclassified ? `. ${UNCLASSIFIED_CAVEAT}` : '';
  const isActivatable = onSelect !== undefined && (cost > 0 || artifacts > 0);
  const readout =
    `${label}: ${formatCurrencyNumberForAnalytics(cost)}, ${formatPercent(share)} of chat spend, ` +
    `${formatCount(artifacts)} work products made, ${formatCount(putToWork)} put to work${caveat}` +
    (isActivatable ? '. Open for detail' : '');
  const numeric = {
    width: COST_WIDTH,
    flexShrink: 0,
    textAlign: 'right' as const,
    fontFamily: theme.fontFamilyMonospace,
  };

  const handleClick = () => {
    if (isActivatable) {
      onSelect(useCase);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (isActivatable && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      onSelect(useCase);
    }
  };

  return (
    <Group
      spacing='sm'
      noWrap
      align='center'
      data-testid={`use-case-row-${useCase}`}
      {...(isActivatable && {
        role: 'button',
        tabIndex: 0,
        onClick: handleClick,
        onKeyDown: handleKeyDown,
      })}
      sx={isActivatable ? {
        cursor: 'pointer',
        '&:hover': {
          backgroundColor: theme.colors.dark[6],
        },
      } : undefined}
    >
      <Text size='xs' color='dark.2' sx={{ width: LABEL_WIDTH, flexShrink: 0 }}>
        {label}
      </Text>

      {/* The track is what anchors every bar to the same baseline, so the bars
          stay comparable when the panel is resized. Growth has to be inline:
          Group styles its children with `& > *`, which outranks any class `sx`
          generates, so `sx={{ flexGrow: 1 }}` here collapses the track to 0. */}
      <Box style={{ flexGrow: 1, minWidth: 0 }}>
        {/* Only the Unclassified row's label is long enough to need wrapping, and
            a fixed width on the eight short ones would leave them mostly empty. */}
        <Tooltip
          label={readout}
          multiline={caveat !== ''}
          width={caveat !== '' ? TOOLTIP_WIDTH : 'auto'}
          withinPortal
        >
          <Box
            data-testid={`use-case-bar-${useCase}`}
            aria-label={readout}
            sx={{
              width,
              height: BAR_HEIGHT,
              backgroundColor: USE_CASE_COLORS[useCase],
              // theme.spacing.xs is this theme's 4px token, which is the rounded
              // data-end radius the dataviz skill specifies. Not theme.radius.md —
              // that is 8px and turns a 14px bar into a lozenge.
              borderRadius: theme.spacing.xs,
            }}
          />
        </Tooltip>
      </Box>

      <Text size='xs' color='dark.1' sx={numeric}>
        {formatCurrencyNumberForAnalytics(cost)}
      </Text>
      <Text size='xs' color='dark.3' sx={{ ...numeric, width: SHARE_WIDTH }}>
        {formatPercent(share)}
      </Text>
      <Text
        size='xs'
        color='dark.2'
        data-testid={`use-case-made-${useCase}`}
        sx={{ ...numeric, width: COUNT_WIDTH }}
      >
        {formatCount(artifacts)}
      </Text>
      <Text
        size='xs'
        color='dark.2'
        data-testid={`use-case-used-${useCase}`}
        sx={{ ...numeric, width: COUNT_WIDTH }}
      >
        {formatCount(putToWork)}
      </Text>
      {/* formatUnitCost renders an em dash for null, and rate() returns null
          rather than 0 when nothing was put to work. A $0.00 here would assert a
          unit cost that does not exist. */}
      <Text
        size='xs'
        color='dark.1'
        data-testid={`use-case-unit-cost-${useCase}`}
        sx={{ ...numeric, width: UNIT_COST_WIDTH }}
      >
        {formatUnitCost(putToWork > 0 ? cost / putToWork : null)}
      </Text>
    </Group>
  );
}

export default function UseCaseSpendSection({
  byUseCase,
  chatCost,
  remainder,
  totalCost,
  systemCost,
  loading,
  onSelectUseCase,
}: UseCaseSpendSectionProps) {
  const theme = useMantineTheme();

  if (loading) {
    return (
      <Box data-testid='use-case-spend-loading'>
        <Skeleton height={320} radius='md' />
      </Box>
    );
  }

  const entries = new Map(byUseCase.map((entry) => [entry.useCase, entry]));
  const maxCost = byUseCase.reduce((max, entry) => Math.max(max, entry.cost), 0);

  // Ordered by size, not by conceptual tidiness: the reader's question is "what
  // is the big one".
  const remainderLines = REMAINDER_KEYS
    .map((key) => ({ key, cost: remainder[key] }))
    .sort((first, second) => second.cost - first.cost);

  const numeric = {
    width: COST_WIDTH,
    flexShrink: 0,
    textAlign: 'right' as const,
    fontFamily: theme.fontFamilyMonospace,
  };

  return (
    <StudioPanel
      icon={<IconTargetArrow size={16} />}
      title="Spend by what they're doing in chat"
      hint='bars scaled to the largest category · % is share of chat spend'
      stats={[]}
    >
      <Stack spacing='sm'>
        <Group spacing='sm' noWrap align='center' data-testid='use-case-columns-header'>
          <Box sx={{ width: LABEL_WIDTH, flexShrink: 0 }} />
          {/* Stands in for the bar track so the headings line up with the columns
              they name; inline for the same Group specificity reason as the track. */}
          <Box style={{ flexGrow: 1, minWidth: 0 }} />
          <Text size='xxs' color='dark.3' sx={numeric}>spend</Text>
          <Box sx={{ width: SHARE_WIDTH, flexShrink: 0 }} />
          <Text size='xxs' color='dark.3' sx={{ ...numeric, width: COUNT_WIDTH }}>made</Text>
          <Text size='xxs' color='dark.3' sx={{ ...numeric, width: COUNT_WIDTH }}>used</Text>
          <Text size='xxs' color='dark.3' sx={{ ...numeric, width: UNIT_COST_WIDTH }}>
            per used
          </Text>
        </Group>

        {USE_CASE_ORDER.map((useCase) => {
          const entry = entries.get(useCase);
          return (
            <UseCaseRow
              key={useCase}
              useCase={useCase}
              cost={entry?.cost ?? 0}
              artifacts={entry?.artifacts ?? 0}
              putToWork={entry?.putToWork ?? 0}
              chatCost={chatCost}
              maxCost={maxCost}
              onSelect={onSelectUseCase}
            />
          );
        })}

        <Divider color='dark.5' />

        {/* Restricting the bars to chat means agent, workflow and platform spend is
            not in them, and spend that silently leaves a total is how a dashboard
            loses an argument. These three name where the rest of it went.
            Deliberately NOT a reconciliation: unattributed spend is not itemized, so
            these plus the bars fall short of the total. The heading says "largest"
            rather than "all" for exactly that reason — a reader who adds the column
            up should expect the total to exceed it, not suspect a bug. */}
        <Stack spacing='xxs' data-testid='use-case-reconciliation'>
          <Group spacing='sm' noWrap position='right' data-testid='use-case-chat-subtotal'>
            <Text size='xs' color='dark.2'>categorized chat spend</Text>
            <Text size='xs' color='dark.0' sx={numeric}>
              {formatCurrencyNumberForAnalytics(chatCost)}
            </Text>
          </Group>

          <Text size='xs' color='dark.3' mt='xs'>Largest spend outside chat</Text>

          {remainderLines.map((line) => (
            <Group
              key={line.key}
              spacing='sm'
              noWrap
              align='center'
              data-testid={`use-case-remainder-${line.key}`}
            >
              <Text size='xs' color='dark.2' style={{ flexGrow: 1, minWidth: 0 }}>
                {REMAINDER_LABELS[line.key]}
              </Text>
              <Text size='xs' color='dark.1' sx={numeric}>
                {formatCurrencyNumberForAnalytics(line.cost)}
              </Text>
            </Group>
          ))}

          {/* totalCost, not a sum of what is rendered above: unattributed spend is
              counted here while going unnamed, which is the whole point of dropping
              its line. Keeping the real total is what lets this tie to the Cost tab. */}
          <Group spacing='sm' noWrap position='right' mt='xs' data-testid='use-case-total-spend'>
            <Text size='xs' color='dark.2'>total spend</Text>
            <Text size='xs' color='dark.0' sx={numeric}>
              {formatCurrencyNumberForAnalytics(totalCost)}
            </Text>
          </Group>

          {/* Named, never added in. System spend is the platform talking to itself —
              including the call that categorizes these chats. Suppressed at zero: a
              "$0.00 system spend" note is noise that reads like a broken figure. */}
          {systemCost > 0 && (
            <Text size='xxs' color='dark.3' data-testid='use-case-system-note'>
              {`plus ${formatCurrencyNumberForAnalytics(systemCost)} system spend, shown on the Cost tab`}
            </Text>
          )}
        </Stack>
      </Stack>
    </StudioPanel>
  );
}
