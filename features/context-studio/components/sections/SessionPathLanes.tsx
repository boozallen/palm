import { useState } from 'react';
import { Box, Center, MantineTheme, ScrollArea, Skeleton, Stack, Text, useMantineTheme } from '@mantine/core';
import { useReducedMotion } from '@mantine/hooks';
import { SessionPath, SessionPathStats } from '@/features/context-studio/types/context-studio';
import StudioLoadError from '@/features/context-studio/components/sections/StudioLoadError';

// One lane per distinct path, ranked by session volume; ribbon thickness carries
// volume. Everyone enters at the first node and exits at the last, trading away
// a Sankey's mid-flow convergence for legibility.

const COUNT_COLUMN = 74;
const SAMPLE_COLUMN = 150;
const TRACK_HEIGHT = 44;
const RIBBON_INSET = 8;
const RIBBON_MIN = 5;
const RIBBON_RANGE = 30;
const NODE_SIZE = 12;
const DIMMED_OPACITY = 0.32;
const SKELETON_LANES = 4;
// Below this the step labels collide, so the lane list scrolls horizontally.
const MIN_LANE_WIDTH = 720;

// Path lane colors by rank, top to bottom. Six ranks then a faint bucket, so a
// reader can tie a lane to its row in any order without a legend.
const pathColors = (theme: MantineTheme): string[] => [
  theme.colors.cyan[4],
  theme.colors.violet[5],
  theme.colors.darkblue[5],
  theme.colors.cyan[7],
  theme.colors.gray[8],
  theme.colors.dark[4],
];

const laneColor = (colors: string[], index: number, isOther: boolean | undefined, dim: string): string =>
  (isOther ? dim : colors[Math.min(index, colors.length - 1)]);

type Props = {
  stats: SessionPathStats | undefined;
  loading: boolean;
  failed?: boolean;
};

export default function SessionPathLanes({ stats, loading, failed = false }: Props) {
  const theme = useMantineTheme();
  const reducedMotion = useReducedMotion();
  const [active, setActive] = useState<string | null>(null);
  const colors = pathColors(theme);

  if (loading) {
    return (
      <Stack spacing={10}>
        {Array.from({ length: SKELETON_LANES }, (_, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 18, padding: '10px 6px' }}>
            <Skeleton height={24} width={COUNT_COLUMN} radius={4} />
            <Skeleton height={RIBBON_MIN + RIBBON_RANGE / (i + 2)} radius={20} sx={{ flex: 1 }} />
            <Skeleton height={18} width={SAMPLE_COLUMN} radius={4} />
          </Box>
        ))}
      </Stack>
    );
  }

  if (failed) {
    return <StudioLoadError />;
  }

  if (!stats || stats.paths.length === 0) {
    return (
      <Center h={120}>
        <Text size='sm' color='dark.3'>No paths recorded in this range.</Text>
      </Center>
    );
  }

  const maxCount = Math.max(...stats.paths.map((p) => p.count), 1);
  const ribbonHeight = (path: SessionPath) => RIBBON_MIN + (path.count / maxCount) * RIBBON_RANGE;

  return (
    <ScrollArea type='auto' offsetScrollbars>
      <Stack spacing={0} sx={{ minWidth: MIN_LANE_WIDTH }}>
        {stats.paths.map((path, index) => {
          const color = laneColor(colors, index, path.isOther, theme.colors.dark[4]);
          const isActive = active === path.id;
          const height = ribbonHeight(path);
          const focusOn = () => setActive(path.id);
          const focusOff = () => setActive((prev) => (prev === path.id ? null : prev));
          return (
            <Box
              key={path.id}
              tabIndex={0}
              aria-label={`${path.count} ${path.count === 1 ? 'session' : 'sessions'}: ${path.steps.join(' then ')}`}
              onMouseEnter={focusOn}
              onMouseLeave={focusOff}
              onFocus={focusOn}
              onBlur={focusOff}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 18,
                padding: '12px 6px',
                borderRadius: 10,
                outline: 'none',
                opacity: active !== null && !isActive ? DIMMED_OPACITY : 1,
                backgroundColor: isActive ? theme.colors.dark[6] : 'transparent',
                transition: reducedMotion ? undefined : 'opacity 120ms, background-color 120ms',
                '&:focus-visible': { boxShadow: `0 0 0 2px ${theme.colors.cyan[4]}` },
              }}
            >
              {/* Count. */}
              <Box sx={{ width: COUNT_COLUMN, flexShrink: 0, textAlign: 'right' }}>
                <Text
                  weight={600}
                  sx={{
                    fontFamily: theme.fontFamilyMonospace,
                    fontSize: 21,
                    lineHeight: 1,
                    color,
                  }}
                >
                  {path.count}
                </Text>
                <Text mt={2} color='dark.3' sx={{ fontSize: 10 }}>
                  {path.count === 1 ? 'session' : 'sessions'}
                </Text>
              </Box>

              {/* Flow track: the ribbon, then evenly spaced nodes on top of it.
                  Step labels hang below each node, never on the ribbon. */}
              <Box sx={{ position: 'relative', flex: 1, minWidth: 0, height: TRACK_HEIGHT }}>
                <Box
                  sx={{
                    position: 'absolute',
                    top: `calc(50% - ${height / 2}px)`,
                    left: RIBBON_INSET,
                    right: RIBBON_INSET,
                    height,
                    borderRadius: height,
                    backgroundColor: color,
                    opacity: isActive ? 0.4 : 0.22,
                    transition: reducedMotion ? undefined : 'opacity 120ms',
                  }}
                />
                <Box
                  sx={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  {path.steps.map((step, stepIndex) => {
                    const isEndpoint = stepIndex === 0 || stepIndex === path.steps.length - 1;
                    return (
                      <Box
                        key={stepIndex}
                        sx={{ position: 'relative', display: 'flex', justifyContent: 'center' }}
                      >
                        <Box
                          sx={{
                            width: NODE_SIZE,
                            height: NODE_SIZE,
                            borderRadius: NODE_SIZE / 2,
                            backgroundColor: theme.colors.dark[7],
                            border: `2px solid ${isEndpoint ? color : theme.colors.gray[8]}`,
                            boxShadow: isEndpoint ? `0 0 0 3px ${color}22` : 'none',
                          }}
                        />
                        <Text
                          sx={{
                            position: 'absolute',
                            top: NODE_SIZE + 4,
                            fontFamily: theme.fontFamilyMonospace,
                            fontSize: 9.5,
                            color: isEndpoint ? theme.colors.gray[7] : theme.colors.dark[3],
                            whiteSpace: 'nowrap',
                            // Nudge the first and last labels inward so they
                            // don't hang past the track's edges.
                            transform: stepIndex === 0
                              ? 'translateX(20%)'
                              : stepIndex === path.steps.length - 1 ? 'translateX(-20%)' : undefined,
                          }}
                        >
                          {step}
                        </Text>
                      </Box>
                    );
                  })}
                </Box>
              </Box>

              {/* Sample user + shape of the path. */}
              <Box sx={{ width: SAMPLE_COLUMN, flexShrink: 0, textAlign: 'right' }}>
                <Text size='xs' color={isActive ? undefined : 'gray.7'}>
                  {path.sampleUser}
                </Text>
                <Text
                  color='dark.3'
                  sx={{ fontFamily: theme.fontFamilyMonospace, fontSize: 10 }}
                >
                  {path.isOther
                    ? 'bucketed'
                    : `${path.steps.length} ${path.steps.length === 1 ? 'step' : 'steps'}${path.window ? ` · ${path.window}` : ''}`}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </ScrollArea>
  );
}
