import React, { useMemo, useRef, useState } from 'react';
import { Box, Center, Skeleton, Stack, Text, useMantineTheme } from '@mantine/core';
import { IconLogin, IconLogout } from '@tabler/icons-react';
import { useReducedMotion } from '@mantine/hooks';
import { ActivitySession, ActivityStats } from '@/features/context-studio/types/context-studio';
import StudioLoadError from '@/features/context-studio/components/sections/StudioLoadError';

// One row per user, time on the x-axis; each block is a session. Width carries
// duration, brightness carries event count, and auth bookends render as their
// own leading/trailing chip so "signed in → … → signed out" survives folding.

const LEFT_RAIL = 186;
const ROW_HEIGHT = 30;
const BLOCK_INSET = 7;
const MIN_BLOCK_PCT = 0.7;
const MIN_BLOCK_PX = 11;
// Event count at which a block reaches full brightness; busier sessions all read
// at the ceiling rather than washing the scale out.
const OPACITY_CEILING = 10;
const MICRO_BAR_WIDTH = 34;
const DAY_MS = 24 * 60 * 60 * 1000;
const HOVER_CARD_WIDTH = 260;
const SKELETON_ROWS = 6;
// Cap the tick count so a long "Forever" range stays readable.
const MAX_TICKS = 30;

const dayLabel = (ms: number): string =>
  new Date(ms).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });

const clock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

// How a session opened and closed, in the words the accessible name uses too, so
// the card and the screen-reader label never diverge.
const openedLabel = (session: ActivitySession): string =>
  (session.startedBySignIn ? 'Signed in' : 'Resumed');
const closedLabel = (session: ActivitySession): string =>
  (session.endedBySignOut ? 'Signed out' : 'Still open');

type HoverState = {
  session: ActivitySession;
  leftPct: number;
  rowIndex: number;
};

type BookendChipProps = {
  label: string;
  // A real auth event reads in the Session category's gray at full strength; an
  // inferred bookend (resumed / still open) is muted and dashed, so the reader
  // can tell a recorded fact from an inferred one without reading the label.
  recorded: boolean;
  icon: React.ReactNode;
};

// The leading/trailing chip on a session card. Shares the path chip's metrics so
// the whole row still reads as one sequence.
function BookendChip({ label, recorded, icon }: BookendChipProps) {
  const theme = useMantineTheme();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        borderRadius: 4,
        padding: '2px 6px',
        color: recorded ? theme.colors.gray[7] : theme.colors.dark[3],
        backgroundColor: recorded ? theme.colors.dark[5] : 'transparent',
        border: `1px ${recorded ? 'solid' : 'dashed'} ${theme.colors.dark[6]}`,
      }}
    >
      {icon}
      <Text sx={{ fontFamily: theme.fontFamilyMonospace, fontSize: 10, color: 'inherit' }}>
        {label}
      </Text>
    </Box>
  );
}

type Props = {
  stats: ActivityStats | undefined;
  loading: boolean;
  failed?: boolean;
};

export default function ActivityStrips({ stats, loading, failed = false }: Props) {
  const theme = useMantineTheme();
  const reducedMotion = useReducedMotion();
  const [hover, setHover] = useState<HoverState | null>(null);
  const laneRef = useRef<HTMLDivElement>(null);

  const start = stats ? new Date(stats.rangeStart).getTime() : 0;
  const end = stats ? new Date(stats.rangeEnd).getTime() : 0;
  const span = Math.max(end - start, 1);

  // Day boundaries across the shared axis, used for both the ticks above the
  // first row and the gridlines inside every lane, so the two always agree.
  const ticks = useMemo(() => {
    if (!stats || !(end > start)) { return []; }
    const firstDay = new Date(start);
    firstDay.setHours(0, 0, 0, 0);
    let cursor = firstDay.getTime();
    if (cursor < start) { cursor += DAY_MS; }
    // Widen the step rather than emit hundreds of ticks on a long range.
    const step = Math.max(Math.ceil(span / (MAX_TICKS * DAY_MS)), 1) * DAY_MS;
    const out: { pct: number; label: string }[] = [];
    for (; cursor <= end; cursor += step) {
      out.push({ pct: ((cursor - start) / span) * 100, label: dayLabel(cursor) });
    }
    return out;
  }, [stats, start, end, span]);

  // Per-user rail stats: session count and the micro-bar fraction against the
  // busiest user's event total.
  const rails = useMemo(() => {
    if (!stats) { return []; }
    const sessionCount = new Map<string, number>();
    const eventCount = new Map<string, number>();
    for (const session of stats.sessions) {
      sessionCount.set(session.userId, (sessionCount.get(session.userId) ?? 0) + 1);
      eventCount.set(session.userId, (eventCount.get(session.userId) ?? 0) + session.eventCount);
    }
    const maxEvents = Math.max(...Array.from(eventCount.values()), 1);
    return stats.users.map((user) => ({
      ...user,
      sessions: sessionCount.get(user.id) ?? 0,
      fraction: (eventCount.get(user.id) ?? 0) / maxEvents,
    }));
  }, [stats]);

  const sessionsByUser = useMemo(() => {
    const map = new Map<string, ActivitySession[]>();
    for (const session of stats?.sessions ?? []) {
      const bucket = map.get(session.userId);
      if (bucket) {
        bucket.push(session);
      } else {
        map.set(session.userId, [session]);
      }
    }
    return map;
  }, [stats]);

  if (loading) {
    return (
      <Stack spacing={6}>
        {Array.from({ length: SKELETON_ROWS }, (_, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', height: ROW_HEIGHT }}>
            <Box sx={{ width: LEFT_RAIL, paddingRight: 10 }}>
              <Skeleton height={10} radius={2} width='70%' />
            </Box>
            <Skeleton height={ROW_HEIGHT - BLOCK_INSET * 2} radius={3} sx={{ flex: 1 }} />
          </Box>
        ))}
      </Stack>
    );
  }

  if (failed) {
    return <StudioLoadError />;
  }

  if (!stats || stats.users.length === 0) {
    return (
      <Center h={120}>
        <Text size='sm' color='dark.3'>No sessions in this range.</Text>
      </Center>
    );
  }

  // The card follows the hovered block's x, but clamps so it never overflows the
  // lane on either edge.
  const laneWidth = laneRef.current?.offsetWidth ?? 0;
  const hoverLeft = hover && laneWidth > 0
    ? Math.min(
      Math.max((hover.leftPct / 100) * laneWidth, HOVER_CARD_WIDTH / 2),
      Math.max(laneWidth - HOVER_CARD_WIDTH / 2, HOVER_CARD_WIDTH / 2),
    )
    : 0;

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Day axis, aligned to the lane by the same left rail offset. */}
      <Box sx={{ display: 'flex', marginBottom: 6 }}>
        <Box sx={{ width: LEFT_RAIL, flexShrink: 0 }} />
        <Box sx={{ position: 'relative', flex: 1, height: 14 }}>
          {ticks.map((tick) => (
            <Text
              key={tick.pct}
              sx={{
                position: 'absolute',
                left: `${tick.pct}%`,
                paddingLeft: 6,
                borderLeft: `1px solid ${theme.colors.dark[7]}`,
                fontFamily: theme.fontFamilyMonospace,
                fontSize: 11,
                color: theme.colors.dark[3],
                whiteSpace: 'nowrap',
              }}
            >
              {tick.label}
            </Text>
          ))}
        </Box>
      </Box>

      {rails.map((rail, rowIndex) => {
        const rowSessions = sessionsByUser.get(rail.id) ?? [];
        const isHoverRow = hover?.rowIndex === rowIndex;
        return (
          <Box
            key={rail.id}
            onMouseLeave={() => setHover((prev) => (prev?.rowIndex === rowIndex ? null : prev))}
            sx={{
              display: 'flex',
              alignItems: 'center',
              height: ROW_HEIGHT,
              borderRadius: 6,
              backgroundColor: isHoverRow ? theme.colors.dark[5] : 'transparent',
            }}
          >
            {/* Left rail: name, session count, events micro-bar. */}
            <Box
              sx={{
                width: LEFT_RAIL,
                flexShrink: 0,
                paddingRight: 10,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text
                title={rail.name}
                weight={rail.isSelf ? 600 : 400}
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: 12,
                  color: rail.isSelf ? theme.colors.cyan[4] : theme.colors.gray[7],
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {rail.name}
              </Text>
              <Text
                sx={{
                  width: 20,
                  textAlign: 'right',
                  fontFamily: theme.fontFamilyMonospace,
                  fontSize: 10.5,
                  color: theme.colors.dark[3],
                }}
              >
                {rail.sessions}
              </Text>
              <Box
                sx={{
                  width: MICRO_BAR_WIDTH,
                  height: 4,
                  flexShrink: 0,
                  borderRadius: 2,
                  backgroundColor: theme.colors.dark[7],
                  overflow: 'hidden',
                }}
              >
                <Box
                  sx={{
                    width: `${rail.fraction * 100}%`,
                    height: '100%',
                    backgroundColor: theme.colors.cyan[7],
                  }}
                />
              </Box>
            </Box>

            {/* Lane: day gridlines behind the session blocks, drawn from the
                same tick positions as the axis so the two always agree. */}
            <Box
              ref={rowIndex === 0 ? laneRef : undefined}
              sx={{ position: 'relative', flex: 1, height: '100%' }}
            >
              {ticks.map((tick) => (
                <Box
                  key={tick.pct}
                  sx={{
                    position: 'absolute',
                    left: `${tick.pct}%`,
                    top: 0,
                    bottom: 0,
                    width: 1,
                    backgroundColor: theme.colors.dark[7],
                  }}
                />
              ))}
              {rowSessions.map((session) => {
                const sessionStart = new Date(session.startedAt).getTime();
                const sessionEnd = new Date(session.endedAt).getTime();
                const leftPct = ((sessionStart - start) / span) * 100;
                const widthPct = Math.max(((sessionEnd - sessionStart) / span) * 100, MIN_BLOCK_PCT);
                const intensity = 0.45 + 0.55 * Math.min(session.eventCount / OPACITY_CEILING, 1);
                const active = hover?.session.id === session.id;
                const focusOn = () => setHover({ session, leftPct, rowIndex });
                return (
                  <Box
                    key={session.id}
                    tabIndex={0}
                    role='button'
                    aria-label={`${session.userName}, ${dayLabel(sessionStart)} ${clock(session.startedAt)}–${clock(session.endedAt)}, ${session.eventCount} ${session.eventCount === 1 ? 'event' : 'events'}, ${openedLabel(session).toLowerCase()} to ${closedLabel(session).toLowerCase()}`}
                    onMouseEnter={focusOn}
                    onFocus={focusOn}
                    onBlur={() => setHover((prev) => (prev?.session.id === session.id ? null : prev))}
                    sx={{
                      position: 'absolute',
                      top: BLOCK_INSET,
                      height: ROW_HEIGHT - BLOCK_INSET * 2,
                      left: `${leftPct}%`,
                      width: `${widthPct}%`,
                      minWidth: MIN_BLOCK_PX,
                      borderRadius: 3,
                      cursor: 'pointer',
                      outline: 'none',
                      backgroundColor: theme.colors.darkblue[5],
                      opacity: active ? 1 : intensity,
                      transition: reducedMotion ? undefined : 'opacity 120ms',
                      boxShadow: active
                        ? `0 0 0 2px ${theme.colors.dark[9]}, 0 0 0 3px ${theme.colors.cyan[4]}`
                        : 'none',
                    }}
                  />
                );
              })}
            </Box>
          </Box>
        );
      })}

      {/* Floating session card, anchored under the hovered block and clamped to
          the lane. Custom rather than a Mantine Tooltip because it has to follow
          the block's x within a single row. */}
      {hover && (
        <Box
          sx={{
            position: 'absolute',
            zIndex: 20,
            top: (hover.rowIndex + 1) * ROW_HEIGHT + 22,
            left: LEFT_RAIL + hoverLeft,
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            width: HOVER_CARD_WIDTH,
            backgroundColor: theme.colors.dark[6],
            border: `1px solid ${theme.colors.dark[6]}`,
            borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0 12px 30px rgba(0,0,0,.55)',
          }}
        >
          <Text weight={600} size='sm' color='gray.1'>
            {hover.session.userName}
          </Text>
          <Text
            mt={3}
            sx={{ fontFamily: theme.fontFamilyMonospace, fontSize: 11, color: theme.colors.gray[7] }}
          >
            {dayLabel(new Date(hover.session.startedAt).getTime())} · {clock(hover.session.startedAt)}–{clock(hover.session.endedAt)} ·{' '}
            <Text component='span' color='cyan.4' sx={{ fontSize: 'inherit', fontFamily: 'inherit' }}>
              {hover.session.eventCount} {hover.session.eventCount === 1 ? 'event' : 'events'}
            </Text>
          </Text>
          {/* Bookend › steps › bookend, one sequence. The auth chips are always
              present — the session opened and closed somehow — so the reader can
              see at a glance whether both ends were actually recorded. */}
          <Box mt={10} sx={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <BookendChip
              label={openedLabel(hover.session)}
              recorded={hover.session.startedBySignIn}
              icon={<IconLogin size={10} />}
            />
            {hover.session.path.map((step, i) => (
              <React.Fragment key={i}>
                <Text color='dark.3' sx={{ fontSize: 10 }}>›</Text>
                <Text
                  sx={{
                    fontFamily: theme.fontFamilyMonospace,
                    fontSize: 10,
                    color: theme.colors.gray[7],
                    backgroundColor: theme.colors.dark[5],
                    border: `1px solid ${theme.colors.dark[6]}`,
                    borderRadius: 4,
                    padding: '2px 6px',
                  }}
                >
                  {step}
                </Text>
              </React.Fragment>
            ))}
            <Text color='dark.3' sx={{ fontSize: 10 }}>›</Text>
            <BookendChip
              label={closedLabel(hover.session)}
              recorded={hover.session.endedBySignOut}
              icon={<IconLogout size={10} />}
            />
          </Box>
        </Box>
      )}
    </Box>
  );
}
