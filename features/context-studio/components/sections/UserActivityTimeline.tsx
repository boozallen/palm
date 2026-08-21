import { ReactNode, useState } from 'react';
import { Box, Center, Collapse, Group, Loader, Stack, Text, ThemeIcon } from '@mantine/core';
import { IconChevronRight, IconDots, IconLogin } from '@tabler/icons-react';
import { UserTrailEntry, UserTrailStats } from '@/features/context-studio/types/context-studio';
import { AuditRecordEvent, AuditRecordOutcome } from '@/features/shared/types/audit-record';
import { categorize, categoryMeta, eventIcon } from '@/features/context-studio/constants/event-categories';

// Failed outcomes ring the bullet rather than recoloring it — outcome is
// orthogonal to the event category, so it must not collide with the category
// color scale.
const ERROR_RING = '#d03b3b';

const BULLET_SIZE = 24;

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;
// Idle gaps shorter than this aren't worth dashing the connector for.
const IDLE_THRESHOLD_MS = 5 * MINUTE_MS;

const formatIdle = (ms: number): string => {
  if (ms >= DAY_MS) { return `${Math.round(ms / DAY_MS)}d idle`; }
  if (ms >= HOUR_MS) { return `${Math.round(ms / HOUR_MS)}h idle`; }
  return `${Math.max(1, Math.round(ms / MINUTE_MS))}m idle`;
};

const formatClock = (iso: string): string =>
  new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

const formatDay = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

const dayKey = (iso: string): string => new Date(iso).toDateString();

type Props = {
  stats: UserTrailStats | undefined;
  loading: boolean;
  userSelected: boolean;
};

export default function UserActivityTimeline({ stats, loading, userSelected }: Props) {
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());

  const toggleRun = (id: string) => {
    setExpandedRuns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  if (!userSelected) {
    return (
      <Center h={120}>
        <Text size='sm' color='dimmed'>Select a user in the filter bar to trace their activity</Text>
      </Center>
    );
  }

  if (loading) {
    return <Center h={200}><Loader size='sm' /></Center>;
  }

  if (!stats || stats.entries.length === 0) {
    return (
      <Center h={120}>
        <Text size='sm' color='dimmed'>No activity for this user in this range</Text>
      </Center>
    );
  }

  // Order: descending days, ascending within each day. The DAL returns entries
  // ascending overall; regroup by day and reverse the day order.
  const byDay = new Map<string, UserTrailEntry[]>();
  const entryTime = (e: UserTrailEntry): string => (e.kind === 'run' ? e.startedAt : e.timestamp);
  for (const entry of stats.entries) {
    const key = dayKey(entryTime(entry));
    const bucket = byDay.get(key);
    if (bucket) { bucket.push(entry); } else { byDay.set(key, [entry]); }
  }
  const days = Array.from(byDay.entries()).reverse();

  return (
    <Stack spacing='xl'>
      {days.map(([day, entries]) => (
        <Box key={day}>
          {/* Section divider: the day label anchors this run of the timeline. */}
          <Text size='xs' color='dimmed' weight={700} tt='uppercase' mb='sm' sx={{ letterSpacing: 0.4 }}>
            {formatDay(entryTime(entries[0]))}
          </Text>
          <Stack spacing={0}>
            {entries.map((entry, i) => (
              <ActivityTimelineItem
                key={entry.id}
                entry={entry}
                expanded={expandedRuns.has(entry.id)}
                onToggle={() => toggleRun(entry.id)}
                isLast={i === entries.length - 1}
              />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

type BulletProps = {
  color: string;
  icon: ReactNode;
  dashed?: boolean;
  errorRing?: boolean;
};

function Bullet({ color, icon, dashed, errorRing }: BulletProps) {
  return (
    <ThemeIcon
      size={BULLET_SIZE}
      radius='xl'
      color={color}
      variant={dashed ? 'outline' : 'filled'}
      sx={{
        flexShrink: 0,
        ...(dashed ? { borderStyle: 'dashed' } : {}),
        ...(errorRing ? { border: `2px solid ${ERROR_RING}` } : {}),
      }}
    >
      {icon}
    </ThemeIcon>
  );
}

type RowProps = {
  bullet: ReactNode;
  dashedConnector: boolean;
  isLast: boolean;
  children: ReactNode;
};

// A hand-rolled bullet + connector row rather than Mantine's Timeline: Timeline's
// bullet is absolutely positioned against the item's own padding, and tuning that
// padding for a non-default bulletSize repeatedly clipped the title text underneath it.
function TimelineRow({ bullet, dashedConnector, isLast, children }: RowProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: BULLET_SIZE, flexShrink: 0, marginRight: 12 }}>
        {bullet}
        {!isLast && (
          <Box
            sx={(theme) => ({
              width: 0,
              flexGrow: 1,
              minHeight: 16,
              borderLeft: `2px ${dashedConnector ? 'dashed' : 'solid'} ${theme.colors.dark[4]}`,
            })}
          />
        )}
      </Box>
      <Box sx={(theme) => ({ flex: 1, minWidth: 0, paddingBottom: theme.spacing.lg })}>
        {children}
      </Box>
    </Box>
  );
}

type ItemProps = {
  entry: UserTrailEntry;
  expanded: boolean;
  onToggle: () => void;
  isLast: boolean;
};

function ActivityTimelineItem({ entry, expanded, onToggle, isLast }: ItemProps) {
  if (entry.kind === 'run') {
    return (
      <TimelineRow
        bullet={<Bullet color='gray' icon={<IconDots size={13} />} dashed />}
        dashedConnector={false}
        isLast={isLast}
      >
        <Group spacing={6} noWrap sx={{ cursor: 'pointer' }} onClick={onToggle}>
          <Text size='sm' weight={600} color='gray.3'>
            {entry.count} navigation {entry.count === 1 ? 'step' : 'steps'}
          </Text>
          <IconChevronRight
            size={13}
            style={{ transform: expanded ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }}
          />
        </Group>
        <Text size='xs' color='dimmed'>
          {formatClock(entry.startedAt)} – {formatClock(entry.endedAt)}
        </Text>
        <Collapse in={expanded}>
          <Stack spacing={2} mt={4}>
            {entry.hrefs.length === 0 ? (
              <Text size='xs' color='dimmed'>No destinations recorded</Text>
            ) : (
              entry.hrefs.map((href, i) => (
                <Text key={`${href}-${i}`} size='xs' color='gray.5' sx={{ fontVariantNumeric: 'tabular-nums' }}>
                  {href}
                </Text>
              ))
            )}
          </Stack>
        </Collapse>
      </TimelineRow>
    );
  }

  const isSignIn = entry.event === AuditRecordEvent.UserSignIn;
  const hasHref = entry.description.includes('(');
  const category = categorize(entry.event, hasHref);
  const meta = categoryMeta(category);
  const Icon = eventIcon(entry.event, hasHref);
  const isError = entry.outcome === AuditRecordOutcome.Error;
  const isIdle = entry.idleBeforeMs >= IDLE_THRESHOLD_MS;

  // Sign-in reads as a bold session marker within the day, distinct from the
  // ordinary event stream.
  if (isSignIn) {
    return (
      <TimelineRow
        bullet={<Bullet color='gray' icon={<IconLogin size={13} />} />}
        // Idle before this item dashes the connector leading down from it.
        dashedConnector={isIdle}
        isLast={isLast}
      >
        <Text size='sm' weight={700} color='gray.2'>Signed in</Text>
        <Text size='xs' color='dimmed'>
          {formatClock(entry.timestamp)}
          {isIdle ? ` · ${formatIdle(entry.idleBeforeMs)}` : ''}
        </Text>
      </TimelineRow>
    );
  }

  return (
    <TimelineRow
      bullet={<Bullet color={meta.color} icon={<Icon size={13} />} errorRing={isError} />}
      dashedConnector={isIdle}
      isLast={isLast}
    >
      <Text size='sm' weight={600} color='gray.3'>{entry.label}</Text>
      <Text size='xs' color='gray.5' lineClamp={2}>{entry.description}</Text>
      <Text size='xs' color='dimmed'>
        {formatClock(entry.timestamp)}
        {isError ? ' · failed' : ''}
        {isIdle ? ` · ${formatIdle(entry.idleBeforeMs)}` : ''}
      </Text>
    </TimelineRow>
  );
}
