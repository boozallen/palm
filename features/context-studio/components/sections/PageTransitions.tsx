import { useMemo, useState } from 'react';
import { Box, Center, MantineTheme, ScrollArea, Skeleton, Text, useMantineTheme } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import { PageTransitionStats } from '@/features/context-studio/types/context-studio';
import StudioLoadError from '@/features/context-studio/components/sections/StudioLoadError';

// From → to matrix. Row = the page left, column = the page arrived at; fill
// intensity carries the count. The diagonal is deliberately blank and excluded
// from the heat scale and exit totals — a self-transition is just a reload.

// Row labels and column headers both show the full path on one line — see
// MIN_ROW_LABEL_W, MIN_CELL_W, and CHAR_W below for how their width grows to
// fit the longest one instead of wrapping or clipping it.
const MIN_ROW_LABEL_W = 90;
const MIN_CELL_W = 40;
const CHAR_W = 6.4;
const CELL_H = 26;
const CELL_GAP = 1;
const EXIT_BAR_W = 46;
const HEADER_H = 34;
const SKELETON_ROWS = 6;
// Above this share of the maximum the fill is bright enough that dark text reads
// better than light text.
const HEAT_DARK_TEXT_THRESHOLD = 0.5;
// Gamma < 1 lifts the low end so a single transition is still visible against
// the surface; without it the bottom third of the ramp reads as empty.
const HEAT_GAMMA = 0.7;

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

// Interpolates the heat ramp at `fraction` (0–1), clamped, from the panel
// background up to the theme's cyan accent.
const heatColor = (theme: MantineTheme, fraction: number): string => {
  const from = hexToRgb(theme.colors.dark[8]);
  const to = hexToRgb(theme.colors.cyan[4]);
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const eased = Math.pow(clamped, HEAT_GAMMA);
  const [r, g, b] = from.map((start, i) => Math.round(start + (to[i] - start) * eased));
  return `rgb(${r},${g},${b})`;
};

type Hover = {
  from: string;
  // Null when the row label is hovered: highlight the row, but there is no
  // column to cross-hair and no pair to read out.
  to: string | null;
};

type Props = {
  stats: PageTransitionStats | undefined;
  loading: boolean;
  failed?: boolean;
};

export default function PageTransitions({ stats, loading, failed = false }: Props) {
  const theme = useMantineTheme();
  const reducedMotion = useReducedMotion();
  const [hover, setHover] = useState<Hover | null>(null);

  // Heat scale and per-row exit totals both ignore the diagonal.
  const { maxValue, exitTotals } = useMemo(() => {
    const totals = new Map<string, number>();
    let max = 0;
    for (const from of stats?.pages ?? []) {
      let total = 0;
      for (const to of stats?.pages ?? []) {
        if (from === to) { continue; }
        const value = stats?.matrix[from]?.[to] ?? 0;
        total += value;
        max = Math.max(max, value);
      }
      totals.set(from, total);
    }
    return { maxValue: max, exitTotals: totals };
  }, [stats]);

  if (loading) {
    return (
      <Box>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: CELL_GAP * 2 }}>
            <Skeleton height={10} width={MIN_ROW_LABEL_W - 10} radius={2} />
            <Skeleton height={CELL_H} radius={4} sx={{ flex: 1 }} />
          </Box>
        ))}
      </Box>
    );
  }

  if (failed) {
    return <StudioLoadError />;
  }

  if (!stats || stats.pages.length === 0) {
    return (
      <Center h={120}>
        <Text size='sm' color='dark.3'>No page transitions in this range.</Text>
      </Center>
    );
  }

  const { pages, matrix } = stats;
  const maxExit = Math.max(...Array.from(exitTotals.values()), 1);

  // Sized to the longest path so nothing needs to wrap or clip: the row label
  // and every column both grow to fit it on one line.
  const longestPage = Math.max(...pages.map((p) => p.length));
  const rowLabelWidth = Math.max(MIN_ROW_LABEL_W, longestPage * CHAR_W + 16);
  const colWidth = Math.max(MIN_CELL_W, longestPage * CHAR_W + 12);

  // The readout replaces a per-cell tooltip: one fixed line, so the eye never
  // has to leave the grid to follow a hover.
  const readout = (() => {
    if (!hover || hover.to === null) {
      return 'Hover a cell — row = from · column = to';
    }
    const value = matrix[hover.from]?.[hover.to] ?? 0;
    if (value === 0) {
      return `${hover.from} → ${hover.to}  no transitions`;
    }
    const exits = exitTotals.get(hover.from) ?? 0;
    const pct = exits > 0 ? Math.round((value / exits) * 100) : 0;
    return `${hover.from} → ${hover.to}  ${value} ${value === 1 ? 'transition' : 'transitions'} · ${pct}% of ${hover.from}'s exits`;
  })();

  return (
    <Box>
      <Text
        sx={{
          fontFamily: theme.fontFamilyMonospace,
          fontSize: 11,
          color: hover?.to ? theme.colors.gray[7] : theme.colors.dark[3],
          marginBottom: 10,
          minHeight: 16,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {readout}
      </Text>

      <ScrollArea type='auto' offsetScrollbars>
        <Box sx={{ display: 'inline-block', minWidth: 'min-content' }}>
          {/* Column headers: the "to" pages, on one line — the column widens
              to fit the longest one rather than wrapping or clipping it. */}
          <Box sx={{ display: 'flex', alignItems: 'flex-end', height: HEADER_H }}>
            <Box sx={{ width: rowLabelWidth, flexShrink: 0 }} />
            {pages.map((page) => (
              <Box key={page} sx={{ width: colWidth, flexShrink: 0, padding: `0 ${CELL_GAP}px` }}>
                <Text
                  title={page}
                  sx={{
                    fontFamily: theme.fontFamilyMonospace,
                    fontSize: 9.5,
                    lineHeight: 1.15,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    color: hover?.to === page ? theme.colors.cyan[4] : theme.colors.dark[3],
                    transition: reducedMotion ? undefined : 'color 120ms',
                  }}
                >
                  {page}
                </Text>
              </Box>
            ))}
          </Box>

          {pages.map((fromPage) => {
            const rowActive = hover?.from === fromPage;
            const exits = exitTotals.get(fromPage) ?? 0;
            return (
              <Box key={fromPage} sx={{ display: 'flex', alignItems: 'center' }}>
                {/* Row label: hovering it highlights the whole row of exits. */}
                <Box
                  onMouseEnter={() => setHover({ from: fromPage, to: null })}
                  onMouseLeave={() => setHover(null)}
                  sx={{
                    width: rowLabelWidth,
                    flexShrink: 0,
                    paddingRight: 8,
                    textAlign: 'right',
                  }}
                >
                  <Text
                    title={fromPage}
                    sx={{
                      fontFamily: theme.fontFamilyMonospace,
                      fontSize: 10.5,
                      color: rowActive ? theme.colors.cyan[4] : theme.colors.gray[7],
                      whiteSpace: 'nowrap',
                      transition: reducedMotion ? undefined : 'color 120ms',
                    }}
                  >
                    {fromPage}
                  </Text>
                </Box>

                {pages.map((toPage) => {
                  const isDiagonal = fromPage === toPage;
                  const value = isDiagonal ? 0 : (matrix[fromPage]?.[toPage] ?? 0);
                  const fraction = maxValue > 0 ? value / maxValue : 0;
                  const inCrossHair = !isDiagonal
                    && (rowActive || (hover?.to !== null && hover?.to === toPage));
                  if (isDiagonal) {
                    return (
                      <Box
                        key={toPage}
                        aria-hidden
                        sx={{
                          width: colWidth,
                          height: CELL_H,
                          flexShrink: 0,
                          margin: CELL_GAP,
                          borderRadius: 4,
                          border: `1px dashed ${theme.colors.dark[7]}`,
                        }}
                      />
                    );
                  }
                  return (
                    <Box
                      key={toPage}
                      tabIndex={0}
                      role='button'
                      aria-label={`${fromPage} to ${toPage}, ${value} ${value === 1 ? 'transition' : 'transitions'}`}
                      onMouseEnter={() => setHover({ from: fromPage, to: toPage })}
                      onMouseLeave={() => setHover(null)}
                      onFocus={() => setHover({ from: fromPage, to: toPage })}
                      onBlur={() => setHover(null)}
                      sx={{
                        width: colWidth,
                        height: CELL_H,
                        flexShrink: 0,
                        margin: CELL_GAP,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'default',
                        outline: 'none',
                        backgroundColor: value === 0 ? theme.colors.dark[8] : heatColor(theme, fraction),
                        border: `1px solid ${inCrossHair ? `${theme.colors.cyan[4]}55` : 'transparent'}`,
                        transition: reducedMotion ? undefined : 'border-color 120ms',
                        '&:focus-visible': { boxShadow: `0 0 0 2px ${theme.colors.cyan[4]}` },
                      }}
                    >
                      <Text
                        weight={600}
                        sx={{
                          fontFamily: theme.fontFamilyMonospace,
                          fontSize: 10.5,
                          color: value === 0
                            ? theme.colors.dark[3]
                            : fraction > HEAT_DARK_TEXT_THRESHOLD ? theme.colors.dark[9] : theme.colors.gray[1],
                        }}
                      >
                        {value === 0 ? '·' : value}
                      </Text>
                    </Box>
                  );
                })}

                {/* Row exit total: how much traffic leaves this page at all. */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 7, paddingLeft: 12 }}>
                  <Box
                    sx={{
                      width: EXIT_BAR_W,
                      height: 4,
                      borderRadius: 2,
                      backgroundColor: theme.colors.dark[7],
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        width: `${(exits / maxExit) * 100}%`,
                        height: '100%',
                        backgroundColor: rowActive ? theme.colors.cyan[4] : theme.colors.cyan[7],
                        transition: reducedMotion ? undefined : 'background-color 120ms',
                      }}
                    />
                  </Box>
                  <Text
                    sx={{
                      fontFamily: theme.fontFamilyMonospace,
                      fontSize: 10,
                      color: rowActive ? theme.colors.gray[7] : theme.colors.dark[3],
                    }}
                  >
                    {exits}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      </ScrollArea>

      {/* Legend: the heat ramp's endpoints, so a fill can be read as a number. */}
      <Box mt={14} sx={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Text color='dark.3' sx={{ fontFamily: theme.fontFamilyMonospace, fontSize: 10 }}>0</Text>
        <Box
          sx={{
            width: 120,
            height: 6,
            borderRadius: 3,
            background: `linear-gradient(to right, ${heatColor(theme, 0)}, ${heatColor(theme, 0.5)}, ${heatColor(theme, 1)})`,
          }}
        />
        <Text color='dark.3' sx={{ fontFamily: theme.fontFamilyMonospace, fontSize: 10 }}>
          {maxValue} transitions
        </Text>
      </Box>
    </Box>
  );
}
