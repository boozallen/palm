import { Fragment, cloneElement, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import mermaid from 'mermaid';
import {
  ActionIcon,
  Badge,
  Box,
  Card,
  Center,
  Grid,
  Group,
  Loader,
  Pagination,
  Popover,
  type PopoverProps,
  RingProgress,
  Select,
  SimpleGrid,
  Skeleton,
  Spoiler,
  Stack,
  Switch,
  Table,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { useDebouncedValue } from '@mantine/hooks';
import { useForm, zodResolver } from '@mantine/form';
import {
  IconBrush,
  IconCalendarTime,
  IconDownload,
  IconFileText,
  IconGridDots,
  IconInfoCircle,
  IconMessageCircle,
  IconPencil,
  IconRoute,
  IconUser,
  IconUsers,
  IconX,
} from '@tabler/icons-react';
import TimeRangeInput from './inputs/TimeRangeInput';
import UserGroupInput from './inputs/UserGroupInput';
import UserInput from './inputs/UserInput';
import useGetPromptStats from '@/features/context-studio/api/get-prompt-stats';
import useGetChatStats from '@/features/context-studio/api/get-chat-stats';
import useGetDocumentStats from '@/features/context-studio/api/get-document-stats';
import useGetAiAgentStats from '@/features/context-studio/api/get-ai-agent-stats';
import useGetWorkflowStats from '@/features/context-studio/api/get-workflow-stats';
import useGetGraphStats from '@/features/context-studio/api/get-graph-stats';
import useGetUserActivityStats from '@/features/context-studio/api/get-user-activity-stats';
import useGetAgentServiceStats from '@/features/context-studio/api/get-agent-service-stats';
import useGetArtifactStats from '@/features/context-studio/api/get-artifact-stats';
import useGetSessionPathStats from '@/features/context-studio/api/get-session-path-stats';
import useGetActivityStrips from '@/features/context-studio/api/get-activity-strips';
import useGetPageTransitions from '@/features/context-studio/api/get-page-transitions';
import useGetUserActivity from '@/features/context-studio/api/get-user-activity';
import useSearchChats from '@/features/context-studio/api/search-chats';
import AgentsPanel from './panels/AgentsPanel';
import StudioPanel from './sections/StudioPanel';
import SessionPathLanes from './sections/SessionPathLanes';
import ActivityStrips from './sections/ActivityStrips';
import PageTransitions from './sections/PageTransitions';
import UserActivityTimeline from './sections/UserActivityTimeline';
import GraphStatsCard from './sections/GraphStatsCard';
import UserGroupsCard from './sections/UserGroupsCard';
import KnowledgeGraphSection from './sections/KnowledgeGraphSection';
import LoginActivitySection from './sections/UserActivitySection';
import CostSection from './sections/cost/CostSection';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import useSearchDocuments from '@/features/context-studio/api/search-documents';
import useSearchUsers from '@/features/context-studio/api/search-users';
import useSearchWorkflowArtifacts from '@/features/context-studio/api/search-workflow-artifacts';
import { getFileTypeConfig } from '@/features/chat/utils/chatHelperFunctions';
import {
  ActivityStats,
  ArtifactStats,
  contextStudioQuerySchema,
  ContextStudioQuery,
  DocumentStats,
  PageTransitionStats,
  PromptStats,
  SessionPathStats,
  TimeRange,
  UserTrailStats,
  WorkflowStats,
} from '@/features/context-studio/types/context-studio';
import {
  ChatSearchQuery,
  chatSearchInitialValues,
  DocumentSearchQuery,
  documentSearchInitialValues,
  WorkflowArtifactSearchQuery,
  workflowArtifactSearchInitialValues,
} from '@/features/context-studio/types/chat-search';
import {
  UserSearchQuery,
  userSearchInitialValues,
} from '@/features/context-studio/types/user-search';
import { DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES } from '@/features/shared/types/document';

const INITIAL_FILTERS: ContextStudioQuery = {
  timeRange: TimeRange.Month,
  userGroupId: 'all',
  userId: 'all',
  excludeAdmins: false,
};

// The views the studio is organized into. Every panel except Cost is scoped by
// the one filter bar above the tab strip, so the tab only decides which sections
// render — never what they are filtered to. Cost is the exception: it arrived
// from the standalone Analytics page with its own filter set (provider, model,
// initiator) and keeps it.
type StudioTab = 'activity' | 'conversations' | 'knowledge' | 'ai-agents' | 'people' | 'cost';

const STUDIO_TABS: { value: StudioTab; label: string }[] = [
  { value: 'activity', label: 'Activity' },
  { value: 'conversations', label: 'Conversations' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'ai-agents', label: 'AI Agents' },
  { value: 'people', label: 'People' },
  { value: 'cost', label: 'Cost' },
];

const CHAT_PAGE_SIZE = 5;
const DOC_PAGE_SIZE = 5;
const USER_PAGE_SIZE = 10;

// tRPC's httpBatchLink fuses every query enabled in the same tick into one GET
// request, which can build a URL past what proxies/WAFs allow when a tab flips
// on 5-7 queries at once — this delays the heavier ones by a tick into a second batch.
function useStaggered(active: boolean): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!active) {
      setReady(false);
      return;
    }
    const id = setTimeout(() => setReady(true), 0);
    return () => clearTimeout(id);
  }, [active]);

  return ready;
}

type UsageStepRecord = {
  stepLabel: string;
  cost: number;
  tokens: number;
};

type ChatMessageRecord = {
  role: string;
  content: string;
  createdAt: string | Date;
  usageSteps: UsageStepRecord[];
};

type DocumentCitationRecord = {
  filename: string;
  citationCount: number;
};

// cost/tokens are the artifact's own share; cumulative* is the chat's spend up
// to and including the message that produced it. Null means unknown, not free —
// see ArtifactRecord in the chat-search types.
type ArtifactDetailRecord = {
  name: string;
  cost: number | null;
  tokens: number | null;
  cumulativeCost: number | null;
  cumulativeTokens: number | null;
};

type ChatRecord = {
  id: string;
  userName: string | null;
  userEmail: string | null;
  summary: string | null;
  createdAt: string | Date;
  documents: DocumentCitationRecord[];
  graphDocuments: DocumentCitationRecord[];
  attachedDocuments: string[];
  artifacts: string[];
  artifactDetails: ArtifactDetailRecord[];
  messages: ChatMessageRecord[];
  graphAnchorCitations: number;
};

type WorkflowArtifactRecord = {
  id: string;
  name: string;
  workflowName: string | null;
  userName: string | null;
  createdAt: string | Date;
  cost: number | null;
  tokens: number | null;
  cumulativeCost: number | null;
  cumulativeTokens: number | null;
};

type DocumentRecord = {
  id: string;
  filename: string;
  userName: string | null;
  userEmail: string | null;
  createdAt: string | Date;
  type: string | null;
  summary: string | null;
};

type UserRecord = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  lastLoginAt: string | Date | null;
  groupCount: number;
  spend: number;
  tokens: number;
};

const formatTimestamp = (ts: string | Date): string =>
  new Date(ts).toLocaleString('en-US', {
    month: 'numeric',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
    timeZoneName: 'short',
  });

const formatDate = (ts: string | Date): string =>
  new Date(ts).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

const formatSpend = (spend: number): string => {
  if (spend === 0) { return '$0.00'; }
  if (spend < 0.001) { return `$${spend.toFixed(6)}`; }
  if (spend < 0.01) { return `$${spend.toFixed(4)}`; }
  return `$${spend.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

// Unlike formatSpend, never flattens to 2 decimals — per-step costs are often
// fractions of a cent apart and that difference is the point of showing them.
const formatExactSpend = (spend: number): string => {
  if (spend === 0) { return '$0.00'; }
  const decimals = spend.toFixed(6).replace(/0+$/, '').split('.')[1]?.length ?? 0;
  return `$${spend.toFixed(Math.max(decimals, 2))}`;
};

// Tolerates a missing/NaN count: a usage row that predates token attribution
// should read as 0 rather than crash the dashboard.
const formatTokens = (tokens: number): string => {
  if (!Number.isFinite(tokens)) { return '0'; }
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`;
  }
  return tokens.toLocaleString();
};

// A cost/token pair, or an em dash when spend is unknown for that artifact.
// Zero cost with a nonzero token count is real — a model with no per-token rate
// configured — so it renders dimmed rather than as unknown.
function SpendCell({
  cost,
  tokens,
  color = 'cyan',
}: {
  cost: number | null;
  tokens: number | null;
  color?: string;
}) {
  if (cost === null) {
    return <Text size='xs' color='dark.3'>—</Text>;
  }

  return (
    <Text size='xs'>
      <Text component='span' weight={600} color={cost > 0 ? color : 'dark.3'}>
        {formatSpend(cost)}
      </Text>
      {tokens !== null && (
        <Text component='span' color='dimmed'>{` · ${formatTokens(tokens)} tokens`}</Text>
      )}
    </Text>
  );
}

const getFileType = (filename: string): string => {
  const lower = filename.toLowerCase();
  const match = DOCUMENT_UPLOAD_ACCEPTED_FILE_TYPES.find((ext) => lower.endsWith(ext));
  return match ?? ('.' + (lower.split('.').pop() ?? 'unknown'));
};

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ContextStudioDashboard() {
  const router = useRouter();
  const track = useTrackClientEvent();
  const [excludeAdmins, setExcludeAdmins] = useState(false);
  const [filters, setFilters] = useState<ContextStudioQuery>(INITIAL_FILTERS);

  // The tab lives in the URL so a view is linkable and survives a refresh. The
  // query param is the source of truth; an unknown value falls back to Activity
  // rather than rendering an empty shell.
  const tabFromUrl = STUDIO_TABS.find((tab) => tab.value === router.query.tab)?.value;
  const activeTab: StudioTab = tabFromUrl ?? 'activity';

  const handleTabChange = (value: string | null) => {
    if (!value) {
      return;
    }
    const tab = STUDIO_TABS.find((t) => t.value === value);
    track.navigate(tab?.label ?? value, `/context-studio?tab=${value}`);
    router.push(
      { pathname: router.pathname, query: { ...router.query, tab: value } },
      undefined,
      { shallow: true },
    );
  };

  const form = useForm<ContextStudioQuery>({
    initialValues: INITIAL_FILTERS,
    validate: zodResolver(contextStudioQuerySchema),
  });

  const prevUserGroupId = useRef(INITIAL_FILTERS.userGroupId);
  useEffect(() => {
    if (form.values.userGroupId !== prevUserGroupId.current) {
      form.setFieldValue('userId', 'all');
      prevUserGroupId.current = form.values.userGroupId;
    }
  }, [form.values.userGroupId]);

  useEffect(() => {
    if (form.isValid()) {
      setFilters({
        timeRange: form.values.timeRange,
        userGroupId: form.values.userGroupId,
        userId: form.values.userId,
        excludeAdmins,
      });
    }
  }, [form.values.timeRange, form.values.userGroupId, form.values.userId, excludeAdmins]);

  // Each query is gated on the tab that renders it, so opening the studio no
  // longer fires every fetch at once. Mantine's Tabs keep hidden panels
  // mounted, so the gate — not the mount — is what keeps them from fetching.
  const onActivity = activeTab === 'activity';
  const onConversations = activeTab === 'conversations';
  const onKnowledge = activeTab === 'knowledge';
  const onAgents = activeTab === 'ai-agents';
  const onPeople = activeTab === 'people';
  const onCost = activeTab === 'cost';

  // Second wave for each tab's larger-input search queries — see useStaggered.
  const onConversationsDeferred = useStaggered(onConversations);
  const onKnowledgeDeferred = useStaggered(onKnowledge);
  const onPeopleDeferred = useStaggered(onPeople);

  const chatStats = useGetChatStats(filters.timeRange, filters.userGroupId, filters.userId, excludeAdmins, onConversations);
  const artifactStats = useGetArtifactStats(filters.timeRange, filters.userGroupId, filters.userId, excludeAdmins, onConversations);
  const documentStats = useGetDocumentStats(filters.timeRange, filters.userGroupId, filters.userId, excludeAdmins, onKnowledge);
  const promptStats = useGetPromptStats(filters.timeRange, filters.userGroupId, filters.userId, excludeAdmins, onConversations || onAgents);
  const aiAgentStats = useGetAiAgentStats(filters.timeRange, filters.userGroupId, filters.userId, onAgents);
  const workflowStats = useGetWorkflowStats(filters.timeRange, filters.userGroupId, filters.userId, onConversations || onAgents);
  const graphStats = useGetGraphStats(filters.timeRange, filters.userGroupId, filters.userId, onKnowledge);
  const userActivityStats = useGetUserActivityStats(filters.timeRange, filters.userGroupId, filters.userId, excludeAdmins, onActivity || onPeople);
  const agentServiceStats = useGetAgentServiceStats(filters.timeRange, filters.userGroupId, filters.userId, onAgents);
  const sessionPathStats = useGetSessionPathStats(filters.timeRange, filters.userGroupId, filters.userId, excludeAdmins, onActivity);
  const activityStats = useGetActivityStrips(filters.timeRange, filters.userGroupId, filters.userId, excludeAdmins, onActivity);
  const pageTransitionStats = useGetPageTransitions(filters.timeRange, filters.userGroupId, filters.userId, excludeAdmins, onActivity);
  const userActivityDetail = useGetUserActivity(
    filters.timeRange,
    filters.userGroupId,
    filters.userId,
    excludeAdmins,
    onActivity && filters.userId !== 'all',
  );

  return (
    <Stack py='md' px='md' spacing='lg'>
      {/* Filter bar — scopes every tab, so it lives above the tab strip and
          persists across tab changes rather than remounting per panel. */}
      <Group align='flex-end' spacing='sm'>
        <TimeRangeInput form={form} />
        <UserGroupInput form={form} />
        <UserInput form={form} />
        {/* The cost query has no admin filter, so the switch is hidden there
            rather than shown as a control that changes nothing. */}
        {!onCost && (
          <Switch
            label='Exclude Admin users'
            checked={excludeAdmins}
            onChange={(e) => setExcludeAdmins(e.currentTarget.checked)}
            data-testid='context-studio-exclude-admins'
            sx={{ alignSelf: 'flex-end', paddingBottom: 4, whiteSpace: 'nowrap' }}
          />
        )}
      </Group>

      <Tabs value={activeTab} onTabChange={handleTabChange}>
        <Tabs.List>
          {STUDIO_TABS.map((tab) => (
            <Tabs.Tab
              key={tab.value}
              value={tab.value}
              data-testid={`context-studio-${tab.value}-tab`}
            >
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {/* Activity — how people move through the app, from whole sessions down
            to a single user's trail. */}
        <Tabs.Panel value='activity' pt='lg' style={{ border: 'none' }}>
          <Stack spacing='lg'>
            <ActivitySection
              stats={activityStats.data}
              loading={activityStats.isFetching}
              failed={activityStats.isError}
            />
            <SessionPathsSection
              stats={sessionPathStats.data}
              loading={sessionPathStats.isFetching}
              failed={sessionPathStats.isError}
            />
            <PageTransitionsSection
              stats={pageTransitionStats.data}
              loading={pageTransitionStats.isFetching}
              failed={pageTransitionStats.isError}
            />
            <Grid>
              <LoginActivitySection
                userActivityStats={userActivityStats.data}
                userActivityStatsLoading={userActivityStats.isFetching}
                timeRange={filters.timeRange}
              />
            </Grid>
            <UserActivitySection
              stats={userActivityDetail.data}
              loading={userActivityDetail.isFetching}
              userSelected={filters.userId !== 'all'}
            />
          </Stack>
        </Tabs.Panel>

        {/* Conversations — what the AI is being asked, and what it produced. */}
        <Tabs.Panel value='conversations' pt='lg' style={{ border: 'none' }}>
          <Stack spacing='lg'>
            <ConversationsSection
              filters={filters}
              excludeAdmins={excludeAdmins}
              withPrompt={chatStats.data?.withPrompt}
              withKbSources={chatStats.data?.withKnowledgeBaseSources}
              withPromptLoading={chatStats.isFetching}
              enabled={onConversationsDeferred}
            />
            <ArtifactsDashboardSection
              filters={filters}
              excludeAdmins={excludeAdmins}
              artifactStats={artifactStats.data}
              artifactStatsLoading={artifactStats.isFetching}
              enabled={onConversationsDeferred}
            />
            <PromptsSection
              promptStats={promptStats.data}
              workflowStats={workflowStats.data}
              workflowLoading={workflowStats.isFetching}
              loading={promptStats.isFetching}
            />
          </Stack>
        </Tabs.Panel>

        {/* Knowledge — the sources answers are grounded in. */}
        <Tabs.Panel value='knowledge' pt='lg' style={{ border: 'none' }}>
          <Stack spacing='lg'>
            <DocumentsSection
              filters={filters}
              excludeAdmins={excludeAdmins}
              documentStats={documentStats.data}
              documentStatsLoading={documentStats.isFetching}
              enabled={onKnowledgeDeferred}
            />
            <Grid>
              <GraphStatsCard
                graphStats={graphStats.data}
                graphStatsLoading={graphStats.isFetching}
              />
            </Grid>
            <KnowledgeGraphSection
              graphStats={graphStats.data}
              graphStatsLoading={graphStats.isFetching}
            />
          </Stack>
        </Tabs.Panel>

        {/* Agents — the agents, services, and providers doing the work. */}
        <Tabs.Panel value='ai-agents' pt='lg' style={{ border: 'none' }}>
          <AgentsPanel
            promptStats={promptStats.data}
            promptStatsLoading={promptStats.isFetching}
            workflowStats={workflowStats.data}
            workflowStatsLoading={workflowStats.isFetching}
            aiAgentStats={aiAgentStats.data}
            aiAgentStatsLoading={aiAgentStats.isFetching}
            agentServiceStats={agentServiceStats.data}
            agentServiceStatsLoading={agentServiceStats.isFetching}
          />
        </Tabs.Panel>

        {/* People — who is using the studio and what it cost. */}
        <Tabs.Panel value='people' pt='lg' style={{ border: 'none' }}>
          <Stack spacing='lg'>
            <UsersSection
              filters={filters}
              excludeAdmins={excludeAdmins}
              enabled={onPeopleDeferred}
            />
            <Grid>
              <UserGroupsCard
                userActivityStats={userActivityStats.data}
                userActivityStatsLoading={userActivityStats.isFetching}
              />
            </Grid>
          </Stack>
        </Tabs.Panel>

        {/* Cost — provider and model spend, moved here from the Analytics page.
            Scoped by the shared filter bar like every other panel; it adds only
            the provider, model, and initiator filters of its own. One query, so
            no useStaggered second wave. */}
        <Tabs.Panel value='cost' pt='lg' style={{ border: 'none' }}>
          <CostSection
            timeRange={filters.timeRange}
            userGroupId={filters.userGroupId}
            userId={filters.userId}
            enabled={onCost}
          />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  );
}

// ─── Stat strip ───────────────────────────────────────────────────────────────

type StatItem = {
  value: number | undefined;
  label: string;
  loading: boolean;
};

function StatStrip({ stats }: { stats: StatItem[] }) {
  return (
    <Box
      sx={(theme) => ({
        display: 'flex',
        alignItems: 'center',
        borderTop: `1px solid ${theme.colors.dark[5]}`,
        borderBottom: `1px solid ${theme.colors.dark[5]}`,
        padding: '8px 0',
        gap: 0,
      })}
    >
      {stats.map((s, i) => (
        <Box
          key={s.label}
          sx={(theme) => ({
            padding: '0 16px',
            paddingLeft: i === 0 ? 4 : undefined,
            borderRight: i < stats.length - 1 ? `1px solid ${theme.colors.dark[5]}` : undefined,
            display: 'flex',
            alignItems: 'baseline',
            gap: 6,
            flexShrink: 0,
          })}
        >
          <Text
            size='sm'
            weight={600}
            color={(s.value ?? 0) > 0 ? 'cyan' : 'dark.3'}
          >
            {s.loading ? '–' : (s.value ?? 0).toLocaleString()}
          </Text>
          <Text size='xs' color='dimmed'>{s.label}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ─── Section card shell ───────────────────────────────────────────────────────

type SectionCardProps = {
  icon: React.ReactNode;
  title: string;
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  searchLeftSection?: React.ReactNode;
  onDownload?: () => void;
  downloadDisabled?: boolean;
  statStrip: React.ReactNode;
  children: React.ReactNode;
};

function SectionCard({
  icon,
  title,
  search,
  onSearchChange,
  searchPlaceholder,
  searchLeftSection,
  onDownload,
  downloadDisabled,
  statStrip,
  children,
}: SectionCardProps) {
  return (
    <Card shadow='sm' padding='md' radius='md' withBorder>
      <Stack spacing='sm'>
        {/* Header row */}
        <Group spacing='xs' noWrap align='center'>
          <ThemeIcon variant='light' c='blue' sx={{ pointerEvents: 'none', flexShrink: 0 }}>
            {icon}
          </ThemeIcon>
          <Text size='sm' weight={600} color='gray.1' sx={{ marginRight: 'auto', whiteSpace: 'nowrap' }}>
            {title}
          </Text>
          {(search !== undefined || onSearchChange !== undefined) && (
            <Group spacing={0} noWrap>
              {searchLeftSection}
              <TextInput
                placeholder={searchPlaceholder}
                size='xs'
                value={search}
                onChange={(e) => onSearchChange?.(e.currentTarget.value)}
                rightSection={
                  search ? (
                    <Box
                      component='button'
                      onClick={() => onSearchChange?.('')}
                      sx={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                    >
                      <IconX size={11} />
                    </Box>
                  ) : undefined
                }
                sx={{ width: 220 }}
              />
            </Group>
          )}
          {onDownload !== undefined && (
            <Tooltip label='Download CSV' withArrow position='bottom'>
              <ActionIcon
                variant='outline'
                color='gray'
                size='sm'
                onClick={onDownload}
                disabled={downloadDisabled}
                aria-label='Download CSV'
                mb='sm'
              >
                <IconDownload size={15} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>

        {/* Inline stat strip */}
        {statStrip}

        {/* Table / content */}
        {children}
      </Stack>
    </Card>
  );
}

// ─── Session paths section ──────────────────────────────────────────────────

type SessionPathsSectionProps = {
  stats: SessionPathStats | undefined;
  loading: boolean;
  failed: boolean;
};

function SessionPathsSection({ stats, loading, failed }: SessionPathsSectionProps) {
  // The "Other paths" bucket is one lane but not one path, so it is excluded
  // from the paths count.
  const pathCount = stats?.paths.filter((path) => !path.isOther).length;

  return (
    <StudioPanel
      icon={<IconRoute size={16} />}
      title='Session paths'
      hint='one lane = one distinct path · thicker = more sessions'
      stats={[
        { value: stats?.totalSessions, label: 'sessions', loading, failed },
        { value: pathCount, label: 'paths', loading, failed },
        { value: stats?.totalNavigations, label: 'navigations', loading, failed },
      ]}
    >
      <SessionPathLanes stats={stats} loading={loading} failed={failed} />
    </StudioPanel>
  );
}

// ─── Activity section ─────────────────────────────────────────────────────────

type ActivitySectionProps = {
  stats: ActivityStats | undefined;
  loading: boolean;
  failed: boolean;
};

function ActivitySection({ stats, loading, failed }: ActivitySectionProps) {
  return (
    <StudioPanel
      icon={<IconCalendarTime size={16} />}
      title='Activity'
      hint='one block = one session, bookended by sign in / sign out · wider = longer · brighter = busier'
      stats={[
        { value: stats?.totalSessions, label: 'sessions', loading, failed },
        // Read against `sessions`: the shortfall is the sessions that resumed
        // after an idle gap, or expired without a sign-out ever being written.
        { value: stats?.signedInSessions, label: 'signed in', loading, failed },
        { value: stats?.signedOutSessions, label: 'signed out', loading, failed },
        { value: stats?.totalEvents, label: 'events', loading, failed },
        { value: stats?.userCount, label: 'users', loading, failed },
      ]}
    >
      <ActivityStrips stats={stats} loading={loading} failed={failed} />
    </StudioPanel>
  );
}

// ─── Page transitions section ─────────────────────────────────────────────────

type PageTransitionsSectionProps = {
  stats: PageTransitionStats | undefined;
  loading: boolean;
  failed: boolean;
};

function PageTransitionsSection({ stats, loading, failed }: PageTransitionsSectionProps) {
  return (
    <StudioPanel
      icon={<IconGridDots size={16} />}
      title='Page transitions'
      hint='row = from · column = to · dashed diagonal = returned to same page'
      stats={[
        { value: stats?.pages.length, label: 'pages', loading, failed },
        { value: stats?.totalTransitions, label: 'transitions', loading, failed },
      ]}
    >
      <PageTransitions stats={stats} loading={loading} failed={failed} />
    </StudioPanel>
  );
}

// ─── User activity section ──────────────────────────────────────────────────

type UserActivitySectionProps = {
  stats: UserTrailStats | undefined;
  loading: boolean;
  userSelected: boolean;
};

function UserActivitySection({ stats, loading, userSelected }: UserActivitySectionProps) {
  const statItems: StatItem[] = [
    { value: stats?.totalRecords, label: 'records', loading },
    { value: stats?.meaningfulRecords, label: 'meaningful', loading },
    { value: stats?.errorRecords, label: 'errors', loading },
  ];

  return (
    <Card shadow='sm' padding='md' radius='md' withBorder>
      <Stack spacing='sm'>
        <Group spacing='xs' noWrap align='center'>
          <ThemeIcon variant='light' c='blue' sx={{ pointerEvents: 'none', flexShrink: 0 }}>
            <IconUser size={16} />
          </ThemeIcon>
          <Text size='sm' weight={600} color='gray.1' sx={{ marginRight: 'auto', whiteSpace: 'nowrap' }}>
            User activity
          </Text>
          <Text size='xs' color='dimmed' sx={{ whiteSpace: 'nowrap' }}>
            {stats?.userName ?? 'Select a user to trace their trail'}
          </Text>
        </Group>
        {userSelected && <StatStrip stats={statItems} />}
        <UserActivityTimeline stats={stats} loading={loading} userSelected={userSelected} />
      </Stack>
    </Card>
  );
}

// ─── Conversations section ────────────────────────────────────────────────────

type ConversationsSectionProps = {
  filters: ContextStudioQuery;
  excludeAdmins: boolean;
  withPrompt: number | undefined;
  withKbSources: number | undefined;
  withPromptLoading: boolean;
  enabled: boolean;
};

function ConversationsSection({ filters, excludeAdmins, withPrompt, withKbSources, withPromptLoading, enabled }: ConversationsSectionProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [queryParams, setQueryParams] = useState<ChatSearchQuery>({
    ...chatSearchInitialValues,
    pageSize: 1000,
    timeRange: filters.timeRange as ChatSearchQuery['timeRange'],
    userGroupId: filters.userGroupId,
    userId: filters.userId,
    excludeAdmins,
  });

  useEffect(() => {
    setQueryParams((prev) => ({
      ...prev,
      timeRange: filters.timeRange as ChatSearchQuery['timeRange'],
      userGroupId: filters.userGroupId,
      userId: filters.userId,
      excludeAdmins,
      search: debouncedSearch || undefined,
    }));
    setPage(1);
  }, [filters, excludeAdmins, debouncedSearch]);

  // `isPending` rather than `isFetching`: a disabled (tab-gated) query reports
  // `isFetching: false` with no data, indistinguishable from a finished query
  // that found nothing — pending keeps the loader up instead of flashing empty.
  const { data, isFetching, isPending } = useSearchChats(queryParams, enabled);
  const records = (data?.records ?? []) as ChatRecord[];
  const pageRecords = records.slice((page - 1) * CHAT_PAGE_SIZE, page * CHAT_PAGE_SIZE);
  const totalPages = Math.ceil(records.length / CHAT_PAGE_SIZE);

  // Derive artifact counts from live records
  const artifactsGenerated = records.filter((r) => r.artifacts.length > 0).length;
  const withUploadedSources = records.filter((r) => r.documents.length > 0).length;
  const documentCitations = records.reduce(
    (sum, r) => sum + r.documents.reduce((docSum, d) => docSum + d.citationCount, 0),
    0,
  );
  const graphAnchorCitations = records.reduce((sum, r) => sum + r.graphAnchorCitations, 0);

  const handleDownload = () => {
    if (!records.length) { return; }
    const header = 'Date,User,Email,Summary,Documents,Citations (RAG),Citations (GraphRAG),Generated Artifacts,Cost,Tokens';
    const rows = records.map((r) => {
      const date = new Date(r.createdAt).toLocaleDateString();
      const summary = (r.summary ?? '').replace(/,/g, ';').replace(/\n/g, ' ');
      const attachedDocumentsList = r.attachedDocuments.join('; ');
      const documentCitationsList = r.documents.map((d) => `${d.filename} (${d.citationCount})`).join('; ');
      const graphCitationsList = r.graphDocuments.map((d) => `${d.filename} (${d.citationCount})`).join('; ');
      const artifacts = r.artifacts.join('; ');
      // Raw numbers, not the abbreviated display strings, so the export stays
      // usable in a spreadsheet.
      const cost = r.messages.reduce((sum, m) => sum + m.usageSteps.reduce((s, u) => s + u.cost, 0), 0);
      const tokens = r.messages.reduce((sum, m) => sum + m.usageSteps.reduce((s, u) => s + u.tokens, 0), 0);
      return `${date},"${r.userName ?? ''}","${r.userEmail ?? ''}","${summary}","${attachedDocumentsList}","${documentCitationsList}","${graphCitationsList}","${artifacts}",${cost},${tokens}`;
    });
    downloadCsv([header, ...rows].join('\n'), 'chat-conversations.csv');
  };

  const statItems: StatItem[] = [
    { value: records.length, label: 'conversations', loading: isPending },
    { value: withPrompt, label: 'with prompt', loading: withPromptLoading },
    { value: artifactsGenerated, label: 'artifacts generated', loading: isPending },
    { value: withUploadedSources, label: 'cited documents', loading: isPending },
    { value: documentCitations, label: 'document citations (RAG)', loading: isPending },
    { value: graphAnchorCitations, label: 'document citations (GraphRAG)', loading: isPending },
    { value: withKbSources, label: 'knowledge base citations', loading: withPromptLoading },
  ];

  return (
    <SectionCard
      icon={<IconMessageCircle size={16} />}
      title='Chat conversations'
      search={search}
      onSearchChange={(v) => { setSearch(v); setPage(1); }}
      searchPlaceholder='Search conversations…'
      onDownload={handleDownload}
      downloadDisabled={!records.length}
      statStrip={<StatStrip stats={statItems} />}
    >
      <ConversationsTable
        records={pageRecords}
        totalRecords={records.length}
        isFetching={isFetching}
        isPending={isPending}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        expandedId={expandedId}
        onRowClick={(id) => setExpandedId(expandedId === id ? null : id)}
      />
    </SectionCard>
  );
}

// ─── Shared hover-popover primitives ──────────────────────────────────────────
// Hover-triggered popover with an arrow, shadow, and multi-line copy, used in
// place of a plain Mantine Tooltip throughout this dashboard.

function HoverPopover({
  target,
  children,
  position = 'bottom',
  width = 260,
}: {
  target: React.ReactElement<{ onMouseEnter?: () => void; onMouseLeave?: () => void }>;
  children: React.ReactNode;
  position?: PopoverProps['position'];
  width?: number;
}) {
  const [opened, setOpened] = useState(false);

  return (
    <Popover opened={opened} onChange={setOpened} position={position} withArrow withinPortal width={width} shadow='md'>
      <Popover.Target>
        {cloneElement(target, {
          onMouseEnter: () => setOpened(true),
          onMouseLeave: () => setOpened(false),
        })}
      </Popover.Target>
      <Popover.Dropdown>{children}</Popover.Dropdown>
    </Popover>
  );
}

// Info-icon column header: label text plus a hover popover explaining the column.
function HeaderInfoPopover({
  label,
  description,
  align = 'left',
  width = 260,
}: {
  label: string;
  description: React.ReactNode;
  align?: 'left' | 'right';
  width?: number;
}) {
  return (
    <Group spacing={4} align='center' noWrap position={align === 'right' ? 'right' : undefined}>
      <Text size='xs' weight={600} sx={{ whiteSpace: 'nowrap' }}>{label}</Text>
      <HoverPopover
        width={width}
        position={align === 'right' ? 'bottom-end' : 'bottom'}
        target={
          <Box sx={{ display: 'inline-flex', alignItems: 'center', color: 'var(--mantine-color-dark-2)', cursor: 'default' }}>
            <IconInfoCircle size={13} />
          </Box>
        }
      >
        {description}
      </HoverPopover>
    </Group>
  );
}

// ─── Citation column headers with info popovers ──────────────────────────────

type CitationHeaderVariant = 'document' | 'graph';

function CitationColumnHeader({ variant }: { variant: CitationHeaderVariant }) {
  const isGraph = variant === 'graph';

  const label = isGraph ? 'Citations (GraphRAG)' : 'Citations (RAG)';

  return (
    <HeaderInfoPopover
      label={label}
      width={280}
      description={
        isGraph ? (
          <Stack spacing={4}>
            <Text size='xs' color='gray.4'>
              <Text component='span' color='violet.4' fw={600}>Knowledge Graph Enhanced (GraphRAG)</Text>
              {' '}— the model retrieved context by traversing entity and relationship anchors in the structured knowledge graph.
            </Text>
            <Text size='xs' color='gray.5'>
              Each citation corresponds to a graph anchor node used to ground the response.
            </Text>
          </Stack>
        ) : (
          <Stack spacing={4}>
            <Text size='xs' color='gray.4'>
              <Text component='span' color='blue.4' fw={600}>Retrieval-Augmented Generation (RAG)</Text>
              {' '}— the model retrieved relevant text chunks from uploaded documents to ground its response.
            </Text>
            <Text size='xs' color='gray.5'>
              Each citation corresponds to a source document passage used in the response.
            </Text>
          </Stack>
        )
      }
    />
  );
}

// ─── Conversations table ──────────────────────────────────────────────────────

type ConversationsTableProps = {
  records: ChatRecord[];
  totalRecords: number;
  isFetching: boolean;
  // True while the query is still disabled or loading for the first time, so a
  // not-yet-started fetch shows the loader rather than an empty result.
  isPending: boolean;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  expandedId: string | null;
  onRowClick: (id: string) => void;
};

function ConversationsTable({
  records,
  totalRecords,
  isFetching,
  isPending,
  page,
  totalPages,
  onPageChange,
  expandedId,
  onRowClick,
}: ConversationsTableProps) {
  if (isPending && totalRecords === 0) {
    return <Center h={120}><Loader size='sm' /></Center>;
  }

  if (!isPending && totalRecords === 0) {
    return (
      <Text size='sm' color='dimmed' py='xl' align='center'>
        No conversations found
      </Text>
    );
  }

  if (isFetching) {
    return <Center h={120}><Loader size='sm' /></Center>;
  }

  return (
    <>
      <Table
        fontSize='xs'
        verticalSpacing='xs'
        highlightOnHover
        sx={(theme) => ({
          '& tbody tr': { cursor: 'pointer' },
          '&[data-hover] > tbody > tr:hover': { backgroundColor: theme.colors.dark[4] },
        })}
      >
        <thead>
          <tr>
            <th>Date</th>
            <th>User</th>
            <th>
              <HeaderInfoPopover
                label='Chat Summary'
                description={
                  <Text size='xs' color='gray.4'>
                    Auto-generated after the first message in the conversation — a quick preview of what the chat is about.
                  </Text>
                }
              />
            </th>
            <th>
              <HeaderInfoPopover
                label='Documents'
                description={
                  <Text size='xs' color='gray.4'>
                    Files attached from the user&apos;s document library — separate from anything retrieved automatically via RAG or GraphRAG.
                  </Text>
                }
              />
            </th>
            <th><CitationColumnHeader variant='document' /></th>
            <th><CitationColumnHeader variant='graph' /></th>
            <th>
              <HeaderInfoPopover
                label='Generated Artifacts'
                description={
                  <Text size='xs' color='gray.4'>
                    Documents, code, or other outputs the assistant produced during the conversation, listed in the order they were generated.
                  </Text>
                }
              />
            </th>
            <th style={{ textAlign: 'right' }}>$ Cost/Token count</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => {
            const hasOutputs = record.documents.length > 0 || record.artifacts.length > 0;
            const isExpanded = expandedId === record.id;
            const chatTotalCost = record.messages.reduce(
              (sum, m) => sum + m.usageSteps.reduce((s, u) => s + u.cost, 0),
              0,
            );
            const chatTotalTokens = record.messages.reduce(
              (sum, m) => sum + m.usageSteps.reduce((s, u) => s + u.tokens, 0),
              0,
            );
            // Tokens, not cost, decide whether spend is known: with per-token
            // rates unset (or a genuinely free model) cost is 0 while tokens
            // are not, and the row should still report its usage.
            const hasChatUsage = chatTotalTokens > 0;
            return (
              <>
                <HoverPopover
                  key={record.id}
                  position='top'
                  width={200}
                  target={
                    <Box
                      component='tr'
                      onClick={() => onRowClick(record.id)}
                      sx={{
                        cursor: 'pointer',
                        borderLeft: hasOutputs ? '2px solid var(--mantine-color-cyan-5)' : '2px solid transparent',
                      }}
                    >
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Text size='xs' color='dimmed'>{formatTimestamp(record.createdAt)}</Text>
                      </td>
                      <td>
                        <Text size='xs'>{record.userName ?? 'Unknown'}</Text>
                      </td>
                      <td onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Spoiler maxHeight={20} maw={280} showLabel='more' hideLabel='less'>
                          <Text size='xs'>{record.summary || '—'}</Text>
                        </Spoiler>
                      </td>
                      <td>
                        <OutputsList items={record.attachedDocuments} />
                      </td>
                      <td>
                        <DocumentCitationsList items={record.documents} />
                      </td>
                      <td>
                        <DocumentCitationsList items={record.graphDocuments} badgeColor='violet' />
                      </td>
                      <td>
                        <OutputsList items={record.artifacts} />
                      </td>
                      <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                        {hasChatUsage ? (
                          <Text size='xs'>
                            <Text component='span' weight={600} color={chatTotalCost > 0 ? 'cyan' : 'dark.3'}>
                              {formatSpend(chatTotalCost)}
                            </Text>
                            <Text component='span' color='dimmed'>{` · ${formatTokens(chatTotalTokens)} tokens`}</Text>
                          </Text>
                        ) : (
                          <Text size='xs' color='dark.3'>—</Text>
                        )}
                      </td>
                    </Box>
                  }
                >
                  <Text size='xs'>{isExpanded ? 'Click to collapse transcript' : 'Click to reveal transcript'}</Text>
                </HoverPopover>
                {expandedId === record.id && (
                  <tr key={`${record.id}-expanded`}>
                    <td colSpan={8} style={{ padding: 0 }}>
                      <Stack
                        p='md'
                        spacing='lg'
                        sx={(theme) => ({
                          maxHeight: 400,
                          overflowY: 'auto',
                          borderTop: `1px solid ${theme.colors.dark[4]}`,
                          borderBottom: `1px solid ${theme.colors.dark[4]}`,
                        })}
                      >
                        {record.messages.map((msg, i) => (
                          <MessageBubble key={i} msg={msg} userName={record.userName} />
                        ))}
                        {hasChatUsage && (
                          <CostBreakdownCard usageSteps={aggregateUsageSteps(record.messages)} />
                        )}
                        <Text size='xs' color='dimmed' align='center' sx={{ fontStyle: 'italic' }}>
                          (end of conversation)
                        </Text>
                      </Stack>
                    </td>
                  </tr>
                )}
              </>
            );
          })}
        </tbody>
      </Table>
      {totalPages > 1 && (
        <Pagination
          total={totalPages}
          value={page}
          onChange={onPageChange}
          position='right'
          size='sm'
          mt='md'
        />
      )}
    </>
  );
}

function OutputsList({ items }: { items: string[] }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 2;

  if (items.length === 0) {
    return null;
  }

  const visible = expanded ? items : items.slice(0, limit);
  const hasMore = items.length > limit;

  return (
    <Stack spacing={2}>
      {visible.map((item, i) => {
        const { color, icon: Icon } = getFileTypeConfig(item);
        return (
          <Group key={i} spacing={6} noWrap>
            <ThemeIcon size={14} c={color} variant='transparent' style={{ flexShrink: 0 }}>
              <Icon size={14} stroke={2} />
            </ThemeIcon>
            <Text size='xs' color='gray.4' lineClamp={1}>{item}</Text>
          </Group>
        );
      })}
      {hasMore && (
        <Text
          size='xs'
          color='dimmed'
          sx={{ cursor: 'pointer' }}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {expanded ? 'Show less' : `+${items.length - limit} more`}
        </Text>
      )}
    </Stack>
  );
}

function DocumentCitationsList({ items, badgeColor = 'gray' }: { items: DocumentCitationRecord[]; badgeColor?: string }) {
  const [expanded, setExpanded] = useState(false);
  const limit = 2;

  if (items.length === 0) {
    return null;
  }

  const visible = expanded ? items : items.slice(0, limit);
  const hasMore = items.length > limit;

  return (
    <Stack spacing={2}>
      {visible.map((item, i) => {
        const { color, icon: Icon } = getFileTypeConfig(item.filename);
        return (
          <Group key={i} spacing={6} noWrap>
            <ThemeIcon size={14} c={color} variant='transparent' style={{ flexShrink: 0 }}>
              <Icon size={14} stroke={2} />
            </ThemeIcon>
            <Text size='xs' color='gray.4' lineClamp={1} style={{ flex: 1 }}>{item.filename}</Text>
            <HoverPopover
              width={200}
              target={<Badge size='xs' color={badgeColor} variant='light' style={{ flexShrink: 0 }}>{item.citationCount}</Badge>}
            >
              <Text size='xs'>
                Cited {item.citationCount} {item.citationCount === 1 ? 'time' : 'times'} across the conversation.
              </Text>
            </HoverPopover>
          </Group>
        );
      })}
      {hasMore && (
        <Text
          size='xs'
          color='dimmed'
          sx={{ cursor: 'pointer' }}
          onClick={(e: React.MouseEvent) => { e.stopPropagation(); setExpanded(!expanded); }}
        >
          {expanded ? 'Show less' : `+${items.length - limit} more`}
        </Text>
      )}
    </Stack>
  );
}

function getStepLabelText(label: string): string {
  if (label === 'plan') { return 'Plan'; }
  if (label === 'response') { return 'Response'; }
  return label.replace(/\+/g, ' + ');
}

function StepLabel({ label }: { label: string }) {
  return <>{getStepLabelText(label)}</>;
}

// Explains what a usage-step badge represents, since step names alone (e.g. 'plan+web_search') don't say what ran.
function getStepDescription(label: string): string {
  if (label === 'plan') {
    return 'The model reasoned through how to approach the request before producing any output.';
  }
  if (label === 'response') {
    return 'Generating the final reply shown to the user.';
  }
  return 'One step in a multi-step tool-calling sequence, combining the tools listed in its name.';
}

function MessageBubble({ msg, userName }: { msg: ChatMessageRecord; userName: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = msg.content.length > 500;
  const isAssistant = msg.role === 'assistant';

  return (
    <Stack spacing={4}>
      <Text size='xs' fw='bold' color={isAssistant ? 'green' : 'blue'}>
        {isAssistant ? 'Assistant' : userName ?? 'User'}
      </Text>
      <Text
        size='sm'
        sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}
        lineClamp={!expanded && isLong ? 4 : undefined}
      >
        {msg.content}
      </Text>
      {isLong && (
        <Text
          size='xs'
          color='blue'
          sx={{ cursor: 'pointer' }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Show less' : 'Show more'}
        </Text>
      )}
    </Stack>
  );
}

// Merges usage steps sharing a label across every message in a conversation into one per-step total.
function aggregateUsageSteps(messages: ChatMessageRecord[]): UsageStepRecord[] {
  const totals = new Map<string, UsageStepRecord>();
  messages.forEach((msg) => {
    msg.usageSteps.forEach((step) => {
      const existing = totals.get(step.stepLabel);
      if (existing) {
        existing.cost += step.cost;
        existing.tokens += step.tokens;
      } else {
        totals.set(step.stepLabel, { ...step });
      }
    });
  });
  return Array.from(totals.values());
}

function CostBreakdownCard({ usageSteps }: { usageSteps: UsageStepRecord[] }) {
  const totalCost = usageSteps.reduce((s, u) => s + u.cost, 0);
  const totalTokens = usageSteps.reduce((s, u) => s + u.tokens, 0);

  return (
    <Box
      sx={(theme) => ({
        maxWidth: 340,
        alignSelf: 'flex-start',
        backgroundColor: theme.colors.dark[6],
        border: `1px solid ${theme.colors.dark[4]}`,
        borderRadius: theme.radius.md,
        padding: `${theme.spacing.xs} ${theme.spacing.sm}`,
      })}
    >
      <Group position='apart' align='baseline' noWrap mb={10}>
        <Text size='xs' color='dimmed' sx={{ letterSpacing: '0.02em' }}>Cost breakdown</Text>
        <Text size='sm' color='gray.4' sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}>
          {formatTokens(totalTokens)} tokens
        </Text>
      </Group>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', columnGap: 14, rowGap: 9, alignItems: 'center' }}>
        {usageSteps.map((step, i) => {
          const tokenShare = totalTokens > 0 ? (step.tokens / totalTokens) * 100 : 0;
          return (
            <Fragment key={i}>
              <HoverPopover
                width={240}
                target={
                  <Text
                    size='sm'
                    color='gray.4'
                    sx={{
                      fontFamily: 'monospace',
                      cursor: 'default',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {step.stepLabel}
                  </Text>
                }
              >
                <Stack spacing={4}>
                  <Text size='sm' fw={600} color='gray.2'><StepLabel label={step.stepLabel} /></Text>
                  <Text size='xs' color='gray.4'>{getStepDescription(step.stepLabel)}</Text>
                  <Text size='xs' color='gray.5'>{formatExactSpend(step.cost)} · {formatTokens(step.tokens)} tokens</Text>
                </Stack>
              </HoverPopover>
              <Text
                size='sm'
                color='dimmed'
                align='right'
                sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
              >
                {formatTokens(step.tokens)}
              </Text>
              <Text
                size='sm'
                color='gray.2'
                align='right'
                sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', minWidth: 44 }}
              >
                {formatExactSpend(step.cost)}
              </Text>
              <Box
                sx={(theme) => ({
                  gridColumn: '1 / -1',
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: theme.colors.dark[5],
                  overflow: 'hidden',
                })}
              >
                <Box
                  sx={(theme) => ({
                    width: `${tokenShare}%`,
                    height: '100%',
                    backgroundColor: theme.colors.cyan[5],
                    opacity: 0.55,
                  })}
                />
              </Box>
            </Fragment>
          );
        })}
      </Box>

      {usageSteps.length > 1 && (
        <Box
          sx={(theme) => ({
            display: 'grid',
            gridTemplateColumns: '1fr auto auto',
            columnGap: 14,
            alignItems: 'center',
            marginTop: 11,
            paddingTop: 10,
            borderTop: `1px solid ${theme.colors.dark[4]}`,
          })}
        >
          <Text size='sm' fw={500} color='gray.2'>Total</Text>
          <Text
            size='sm'
            color='dimmed'
            align='right'
            sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums' }}
          >
            {formatTokens(totalTokens)}
          </Text>
          <Text
            size='sm'
            fw={500}
            color='gray.2'
            align='right'
            sx={{ fontFamily: 'monospace', fontVariantNumeric: 'tabular-nums', minWidth: 44 }}
          >
            {formatExactSpend(totalCost)}
          </Text>
        </Box>
      )}
    </Box>
  );
}

// ─── Documents section ────────────────────────────────────────────────────────

type DocumentsSectionProps = {
  filters: ContextStudioQuery;
  excludeAdmins: boolean;
  documentStats: DocumentStats | undefined;
  documentStatsLoading: boolean;
  enabled: boolean;
};

function DocumentsSection({ filters, excludeAdmins, documentStats, documentStatsLoading, enabled }: DocumentsSectionProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [page, setPage] = useState(1);
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const [queryParams, setQueryParams] = useState<DocumentSearchQuery>({
    ...documentSearchInitialValues,
    pageSize: 1000,
    timeRange: filters.timeRange as DocumentSearchQuery['timeRange'],
    userGroupId: filters.userGroupId,
    userId: filters.userId,
    excludeAdmins,
  });

  useEffect(() => {
    setQueryParams((prev) => ({
      ...prev,
      timeRange: filters.timeRange as DocumentSearchQuery['timeRange'],
      userGroupId: filters.userGroupId,
      userId: filters.userId,
      excludeAdmins,
      search: debouncedSearch || undefined,
    }));
    setPage(1);
    setSelectedType(null);
  }, [filters, excludeAdmins, debouncedSearch]);

  // See ConversationsSection: pending covers the gated-and-not-yet-started case
  // that `isFetching` alone reports as an empty result.
  const { data, isFetching, isPending } = useSearchDocuments(queryParams, enabled);
  const records = (data?.records ?? []) as DocumentRecord[];

  // By-type breakdown from all records
  const byType = records.reduce<Record<string, number>>((acc, r) => {
    const t = getFileType(r.filename);
    acc[t] = (acc[t] ?? 0) + 1;
    return acc;
  }, {});
  const typeEntries = Object.entries(byType).sort((a, b) => b[1] - a[1]);

  const filteredRecords = selectedType
    ? records.filter((r) => getFileType(r.filename) === selectedType)
    : records;

  const pageRecords = filteredRecords.slice((page - 1) * DOC_PAGE_SIZE, page * DOC_PAGE_SIZE);
  const totalPages = Math.ceil(filteredRecords.length / DOC_PAGE_SIZE);

  const handleDownload = () => {
    if (!records.length) { return; }
    const header = 'Document,Owner,Uploaded,Summary';
    const rows = records.map((r) => {
      const date = new Date(r.createdAt).toLocaleDateString();
      const summary = (r.summary ?? '').replace(/,/g, ';').replace(/\n/g, ' ');
      return `"${r.filename}","${r.userName ?? ''}",${date},"${summary}"`;
    });
    downloadCsv([header, ...rows].join('\n'), 'documents.csv');
  };

  const statItems: StatItem[] = [
    { value: records.length, label: 'documents uploaded', loading: isPending },
    { value: documentStats?.shared, label: 'share actions', loading: documentStatsLoading },
    { value: documentStats?.accepted, label: 'share acceptances', loading: documentStatsLoading },
    { value: documentStats?.rejected, label: 'share rejections', loading: documentStatsLoading },
  ];

  const typeSelectData = [
    { value: '', label: 'File types' },
    ...typeEntries.map(([ext, count]) => ({
      value: ext,
      label: `${ext.replace('.', '')} (${count})`,
    })),
  ];

  const fileTypeDropdown = typeEntries.length > 0 ? (
    <Select
      size='xs'
      data={typeSelectData}
      value={selectedType ?? ''}
      onChange={(v) => { setSelectedType(v || null); setPage(1); }}
      mr='sm'
      sx={{ width: 130 }}
    />
  ) : undefined;

  return (
    <SectionCard
      icon={<IconFileText size={16} />}
      title='Documents'
      search={search}
      onSearchChange={(v) => { setSearch(v); setPage(1); }}
      searchPlaceholder='Search documents…'
      searchLeftSection={fileTypeDropdown}
      onDownload={handleDownload}
      downloadDisabled={!records.length}
      statStrip={<StatStrip stats={statItems} />}
    >
      <DocumentsTable
        records={pageRecords}
        totalRecords={records.length}
        isFetching={isFetching}
        isPending={isPending}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </SectionCard>
  );
}

// ─── Documents table ──────────────────────────────────────────────────────────

type DocumentsTableProps = {
  records: DocumentRecord[];
  totalRecords: number;
  isFetching: boolean;
  // True while the query is still disabled or loading for the first time, so a
  // not-yet-started fetch shows the loader rather than an empty result.
  isPending: boolean;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
};

function DocumentsTable({
  records,
  totalRecords,
  isFetching,
  isPending,
  page,
  totalPages,
  onPageChange,
}: DocumentsTableProps) {
  if (isPending && totalRecords === 0) {
    return <Center h={120}><Loader size='sm' /></Center>;
  }

  if (!isPending && totalRecords === 0) {
    return (
      <Text size='sm' color='dimmed' py='xl' align='center'>
        No documents found
      </Text>
    );
  }

  if (isFetching) {
    return <Center h={120}><Loader size='sm' /></Center>;
  }

  return (
    <>
      <Table
        fontSize='xs'
        verticalSpacing='xs'
        highlightOnHover
        sx={(theme) => ({
          '& tbody tr:hover': { backgroundColor: theme.colors.dark[4] },
        })}
      >
        <thead>
          <tr>
            <th>Document</th>
            <th>Owner</th>
            <th>Date Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                {(() => {
                  const { color, icon: Icon } = getFileTypeConfig(record.filename);
                  return (
                    <Group spacing={6} noWrap>
                      <ThemeIcon size={14} c={color} variant='transparent' style={{ flexShrink: 0 }}>
                        <Icon size={14} stroke={2} />
                      </ThemeIcon>
                      <Text size='xs'>{record.filename}</Text>
                    </Group>
                  );
                })()}
              </td>
              <td>
                <Text size='xs'>{record.userName ?? 'Unknown'}</Text>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <Text size='xs' color='dimmed'>{formatDate(record.createdAt)}</Text>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {totalPages > 1 && (
        <Pagination
          total={totalPages}
          value={page}
          onChange={onPageChange}
          position='right'
          size='sm'
          mt='md'
        />
      )}
    </>
  );
}

// ─── Users section ────────────────────────────────────────────────────────────

type MembershipStatus = UserSearchQuery['membershipStatus'];

type UsersSectionProps = {
  filters: ContextStudioQuery;
  excludeAdmins: boolean;
  enabled: boolean;
};

function UsersSection({ filters, excludeAdmins, enabled }: UsersSectionProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [page, setPage] = useState(1);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus>('all');

  const [queryParams, setQueryParams] = useState<UserSearchQuery>({
    ...userSearchInitialValues,
    pageSize: 1000,
    // Users are always shown lifetime — the dashboard TimeRange filter does not apply here.
    timeRange: TimeRange.Forever,
    userGroupId: filters.userGroupId,
    userId: filters.userId,
    excludeAdmins,
  });

  useEffect(() => {
    setQueryParams((prev) => ({
      ...prev,
      userGroupId: filters.userGroupId,
      userId: filters.userId,
      excludeAdmins,
      membershipStatus,
      search: debouncedSearch || undefined,
    }));
    setPage(1);
  }, [filters.userGroupId, filters.userId, excludeAdmins, membershipStatus, debouncedSearch]);

  // See ConversationsSection: pending covers the gated-and-not-yet-started case
  // that `isFetching` alone reports as an empty result.
  const { data, isFetching, isPending } = useSearchUsers(queryParams, enabled);
  const records = (data?.records ?? []) as UserRecord[];

  const pageRecords = records.slice((page - 1) * USER_PAGE_SIZE, page * USER_PAGE_SIZE);
  const totalPages = Math.ceil(records.length / USER_PAGE_SIZE);

  const totalSpend = records.reduce((sum, r) => sum + r.spend, 0);
  const totalTokens = records.reduce((sum, r) => sum + r.tokens, 0);
  const memberCount = records.filter((r) => r.groupCount > 0).length;

  const handleDownload = () => {
    if (!records.length) { return; }
    const header = 'User,Email,Role,Last Login,Group Memberships,Lifetime Spend (USD),Lifetime Tokens';
    const rows = records.map((r) => {
      const lastLogin = r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString() : 'Never';
      return `"${r.name ?? ''}","${r.email ?? ''}",${r.role},${lastLogin},${r.groupCount},${r.spend.toFixed(2)},${r.tokens}`;
    });
    downloadCsv([header, ...rows].join('\n'), 'users.csv');
  };

  const statItems: StatItem[] = [
    { value: records.length, label: 'users', loading: isPending },
    { value: memberCount, label: 'in at least 1 user group', loading: isPending },
  ];

  const membershipDropdown = (
    <Select
      size='xs'
      data={[
        { value: 'all', label: 'All users' },
        { value: 'members', label: '1+ user group memberships' },
        { value: 'nonMembers', label: 'No user group memberships' },
      ]}
      value={membershipStatus}
      onChange={(v) => { setMembershipStatus((v as MembershipStatus) ?? 'all'); setPage(1); }}
      mr='sm'
      sx={{ width: 220 }}
    />
  );

  return (
    <SectionCard
      icon={<IconUsers size={16} />}
      title='Users'
      search={search}
      onSearchChange={(v) => { setSearch(v); setPage(1); }}
      searchPlaceholder='Search users…'
      searchLeftSection={membershipDropdown}
      onDownload={handleDownload}
      downloadDisabled={!records.length}
      statStrip={
        <Group position='apart' align='center' noWrap>
          <StatStrip stats={statItems} />
          <Text size='xs' color='dimmed'>
            {`Totals across ${records.length.toLocaleString()} user${records.length === 1 ? '' : 's'}: `}
            <Text component='span' weight={600} color='cyan'>{formatSpend(totalSpend)}</Text>
            {` · ${formatTokens(totalTokens)} tokens`}
          </Text>
        </Group>
      }
    >
      <UsersTable
        records={pageRecords}
        totalRecords={records.length}
        isFetching={isFetching}
        isPending={isPending}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
      />
    </SectionCard>
  );
}

// ─── Users table ──────────────────────────────────────────────────────────────

type UsersTableProps = {
  records: UserRecord[];
  totalRecords: number;
  isFetching: boolean;
  // True while the query is still disabled or loading for the first time, so a
  // not-yet-started fetch shows the loader rather than an empty result.
  isPending: boolean;
  page: number;
  totalPages: number;
  onPageChange: (p: number) => void;
};

function UsersTable({
  records,
  totalRecords,
  isFetching,
  isPending,
  page,
  totalPages,
  onPageChange,
}: UsersTableProps) {
  if (isPending && totalRecords === 0) {
    return <Center h={120}><Loader size='sm' /></Center>;
  }

  if (!isPending && totalRecords === 0) {
    return (
      <Text size='sm' color='dimmed' py='xl' align='center'>
        No users found
      </Text>
    );
  }

  if (isFetching) {
    return <Center h={120}><Loader size='sm' /></Center>;
  }

  return (
    <>
      <Table
        fontSize='xs'
        verticalSpacing='xs'
        highlightOnHover
        sx={(theme) => ({
          '& tbody tr:hover': { backgroundColor: theme.colors.dark[4] },
        })}
      >
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Last Login</th>
            <th>User Groups</th>
            <th style={{ textAlign: 'right' }}>
              <Group spacing='xs' align='center' position='right' noWrap>
                $ Cost/Token count
                <Tooltip
                  label='Total aggregate usage'
                  withArrow
                  styles={{ tooltip: { fontWeight: 400 } }}
                >
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', color: 'var(--mantine-color-dark-2)' }}>
                    <IconInfoCircle size={14} />
                  </Box>
                </Tooltip>
              </Group>
            </th>
          </tr>
        </thead>
        <tbody>
          {records.map((record) => (
            <tr key={record.id}>
              <td>
                <Stack spacing={0}>
                  <Text size='xs'>{record.name ?? 'Unknown'}</Text>
                  {record.email && <Text size='xs' color='dimmed'>{record.email}</Text>}
                </Stack>
              </td>
              <td>
                <Badge size='xs' variant='light' color={record.role === 'Admin' ? 'grape' : 'gray'}>
                  {record.role}
                </Badge>
              </td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <Text size='xs' color='dimmed'>
                  {record.lastLoginAt ? formatTimestamp(record.lastLoginAt) : 'Never'}
                </Text>
              </td>
              <td>
                {record.groupCount > 0 ? (
                  <Badge size='xs' variant='light' color='cyan'>
                    {record.groupCount}
                  </Badge>
                ) : (
                  <Text size='xs' color='dimmed'>—</Text>
                )}
              </td>
              <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                <Text size='xs'>
                  <Text component='span' weight={600} color={record.spend > 0 ? 'cyan' : 'dark.3'}>
                    {formatSpend(record.spend)}
                  </Text>
                  <Text component='span' color='dimmed'>{` · ${formatTokens(record.tokens)} tokens`}</Text>
                </Text>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      {totalPages > 1 && (
        <Pagination
          total={totalPages}
          value={page}
          onChange={onPageChange}
          position='right'
          size='sm'
          mt='md'
        />
      )}
    </>
  );
}

// ─── Mermaid pie chart ────────────────────────────────────────────────────────

type MermaidPieChartProps = {
  title: string;
  slices: { label: string; value: number }[];
};

let mermaidInitialized = false;

function MermaidPieChart({ title, slices }: MermaidPieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(`mermaid-pie-${Math.random().toString(36).slice(2)}`);

  const definition = [
    `pie title ${title}`,
    ...slices.map((s) => `  "${s.label}" : ${s.value}`),
  ].join('\n');

  useEffect(() => {
    if (!containerRef.current || slices.length === 0) { return; }

    if (!mermaidInitialized) {
      mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      mermaidInitialized = true;
    }

    const id = idRef.current;
    mermaid.render(id, definition).then(({ svg }) => {
      if (containerRef.current) {
        containerRef.current.innerHTML = svg;
      }
    }).catch(() => {});
  }, [definition, slices.length]);

  if (slices.length === 0) {
    return (
      <Center h={180}>
        <Text size='xs' color='dimmed'>No data</Text>
      </Center>
    );
  }

  return <div ref={containerRef} style={{ width: '100%' }} />;
}

// ─── Artifacts dashboard section ─────────────────────────────────────────────

const ARTIFACT_COLORS = ['cyan', 'violet', 'orange', 'pink', 'teal', 'indigo', 'grape', 'lime', 'yellow', 'blue', 'red', 'green', 'gray'];

// Shared donut+legend used by each source's "by file type" chart.
function renderArtifactsByTypeChart(
  title: string,
  byType: { type: string; count: number }[],
  total: number,
) {
  return (
    <Box
      key={title}
      sx={(theme) => ({
        padding: '10px 14px',
        borderRadius: theme.radius.sm,
        border: `1px solid ${theme.colors.dark[4]}`,
      })}
    >
      <Text size='sm' weight={700} color='gray.1' mb={8}>{title}</Text>
      {byType.length === 0 ? (
        <Center h={180}><Text size='xs' color='dimmed'>No data</Text></Center>
      ) : (
        <Group position='center' align='center'>
          <RingProgress
            size={180}
            thickness={20}
            sections={byType.map((t, i) => ({
              value: total > 0 ? (t.count / total) * 100 : 0,
              color: ARTIFACT_COLORS[i % ARTIFACT_COLORS.length],
              tooltip: `${t.type}: ${t.count} (${total > 0 ? ((t.count / total) * 100).toFixed(1) : 0}%)`,
            }))}
            label={
              <Stack spacing={0} align='center'>
                <Text size='lg' weight={700}>{total}</Text>
                <Text size='xs' color='dimmed'>Total</Text>
              </Stack>
            }
          />
          <Stack spacing={4} style={{ maxHeight: 200, overflowY: 'auto' }}>
            {byType.map((t, i) => {
              const { color, icon: Icon } = getFileTypeConfig(`.${t.type}`);
              return (
                <Group key={t.type} spacing={6} noWrap>
                  <Box sx={(theme) => ({ width: 10, height: 10, borderRadius: 2, flexShrink: 0, backgroundColor: theme.colors[ARTIFACT_COLORS[i % ARTIFACT_COLORS.length]][6] })} />
                  <ThemeIcon size='sm' c={color} style={{ backgroundColor: 'transparent' }}>
                    <Icon size={12} stroke={1.5} />
                  </ThemeIcon>
                  <Text size='xs' weight={500}>{t.type}</Text>
                  <Text size='xs' color='dimmed'>{t.count}</Text>
                </Group>
              );
            })}
          </Stack>
        </Group>
      )}
    </Box>
  );
}

type ArtifactRow = {
  name: string;
  source: 'chat' | 'workflow';
  userName: string;
  cost: number | null;
  tokens: number | null;
  cumulativeCost: number | null;
  cumulativeTokens: number | null;
};

type ArtifactsDashboardSectionProps = {
  filters: ContextStudioQuery;
  excludeAdmins: boolean;
  artifactStats: ArtifactStats | undefined;
  artifactStatsLoading: boolean;
  enabled: boolean;
};

const ARTIFACT_PAGE_SIZE = 5;

function ArtifactsDashboardSection({
  filters,
  excludeAdmins,
  artifactStats,
  artifactStatsLoading,
  enabled,
}: ArtifactsDashboardSectionProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [page, setPage] = useState(1);

  const [queryParams, setQueryParams] = useState<ChatSearchQuery>({
    ...chatSearchInitialValues,
    pageSize: 1000,
    timeRange: filters.timeRange as ChatSearchQuery['timeRange'],
    userGroupId: filters.userGroupId,
    userId: filters.userId,
    excludeAdmins,
  });

  const [workflowQueryParams, setWorkflowQueryParams] = useState<WorkflowArtifactSearchQuery>({
    ...workflowArtifactSearchInitialValues,
    pageSize: 1000,
    timeRange: filters.timeRange as WorkflowArtifactSearchQuery['timeRange'],
    userGroupId: filters.userGroupId,
    userId: filters.userId,
    excludeAdmins,
  });

  useEffect(() => {
    setQueryParams((prev) => ({
      ...prev,
      timeRange: filters.timeRange as ChatSearchQuery['timeRange'],
      userGroupId: filters.userGroupId,
      userId: filters.userId,
      excludeAdmins,
    }));
    setWorkflowQueryParams((prev) => ({
      ...prev,
      timeRange: filters.timeRange as WorkflowArtifactSearchQuery['timeRange'],
      userGroupId: filters.userGroupId,
      userId: filters.userId,
      excludeAdmins,
    }));
    setPage(1);
  }, [filters, excludeAdmins]);

  // See ConversationsSection: pending covers the gated-and-not-yet-started case
  // that `isFetching` alone reports as an empty result.
  const { data: chatData, isFetching: chatFetching, isPending: chatPending } =
    useSearchChats(queryParams, enabled);
  const chatRecords = (chatData?.records ?? []) as ChatRecord[];

  const { data: workflowData, isFetching: workflowFetching, isPending: workflowPending } =
    useSearchWorkflowArtifacts(workflowQueryParams, enabled);
  const workflowRecords = (workflowData?.records ?? []) as WorkflowArtifactRecord[];

  // Flatten chat artifacts into rows (method unknown at row level — filter by stats counts)
  const chatArtifactRows: ArtifactRow[] = chatRecords.flatMap((r) =>
    r.artifactDetails.map((artifact) => ({
      name: artifact.name,
      source: 'chat' as const,
      userName: r.userName ?? 'Unknown',
      cost: artifact.cost,
      tokens: artifact.tokens,
      cumulativeCost: artifact.cumulativeCost,
      cumulativeTokens: artifact.cumulativeTokens,
    })),
  );

  // One row per workflow artifact, so each can carry its own attributed cost.
  const workflowArtifactRows: ArtifactRow[] = workflowRecords.map((r) => ({
    name: r.name,
    source: 'workflow' as const,
    userName: r.userName ?? 'Unknown',
    cost: r.cost,
    tokens: r.tokens,
    cumulativeCost: r.cumulativeCost,
    cumulativeTokens: r.cumulativeTokens,
  }));

  // All rows combined
  const allRows = [...chatArtifactRows, ...workflowArtifactRows];

  // Build file type options from all rows
  const typeCountMap = allRows.reduce<Record<string, number>>((acc, r) => {
    const ext = getFileType(r.name);
    acc[ext] = (acc[ext] ?? 0) + 1;
    return acc;
  }, {});
  const typeEntries = Object.entries(typeCountMap).sort((a, b) => b[1] - a[1]);

  // Filter rows
  const filteredRows = allRows.filter((r) => {
    if (selectedSource === 'chat' && r.source !== 'chat') { return false; }
    if (selectedSource === 'workflow' && r.source !== 'workflow') { return false; }
    if (selectedType && getFileType(r.name) !== selectedType) { return false; }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      if (!r.name.toLowerCase().includes(q) && !r.userName.toLowerCase().includes(q)) { return false; }
    }
    return true;
  });

  const totalPages = Math.ceil(filteredRows.length / ARTIFACT_PAGE_SIZE);
  const pageRows = filteredRows.slice((page - 1) * ARTIFACT_PAGE_SIZE, page * ARTIFACT_PAGE_SIZE);

  // Chat and Workflow are two independent artifact sources, each charted on
  // its own — Agent Provider vs LLM Model is a sub-detail of Chat only, since
  // a workflow artifact is always AI-provider-powered.
  const chatTotal = artifactStats?.chat ?? 0;
  const workflowTotal = artifactStats?.workflow ?? 0;
  const modelOnlyTotal = artifactStats?.chatArtifacts.byCreationMethod.modelOnly.total ?? 0;
  const agentProviderTotal = artifactStats?.chatArtifacts.byCreationMethod.agentProvider.total ?? 0;
  // A chat artifact predating the modelId/agentProviderId guarantee can have
  // neither set — keep a residual bucket rather than letting it vanish.
  const otherChatTotal = Math.max(chatTotal - modelOnlyTotal - agentProviderTotal, 0);

  const chatCreationMethodSections = [
    { label: 'Agent Provider', value: agentProviderTotal, color: 'violet' },
    { label: 'LLM Model', value: modelOnlyTotal, color: 'cyan' },
    { label: 'Other', value: otherChatTotal, color: 'gray' },
  ].filter((s) => s.value > 0);

  const sourceDropdown = (
    <Select
      size='xs'
      data={[
        { value: '', label: 'All artifacts' },
        { value: 'chat', label: 'Chat artifacts' },
        { value: 'workflow', label: 'Workflow artifacts' },
      ]}
      value={selectedSource}
      onChange={(v) => { setSelectedSource(v ?? ''); setPage(1); }}
      mr='sm'
      sx={{ width: 150 }}
    />
  );

  const fileTypeDropdown = (
    <Select
      size='xs'
      data={[
        { value: '', label: 'File types' },
        ...typeEntries.map(([ext, count]) => ({
          value: ext,
          label: `${ext.replace('.', '')} (${count})`,
        })),
      ]}
      value={selectedType}
      onChange={(v) => { setSelectedType(v ?? ''); setPage(1); }}
      mr='sm'
      sx={{ width: 130 }}
    />
  );

  const isFetching = chatFetching || workflowFetching || artifactStatsLoading;
  // Drives the loader and empty states; `isFetching` still drives the dimming,
  // which should only apply to a refetch that is genuinely in flight.
  const isPending = chatPending || workflowPending || artifactStatsLoading;

  return (
    <SectionCard
      icon={<IconBrush size={16} />}
      title='Artifacts'
      search={search}
      onSearchChange={(v) => { setSearch(v); setPage(1); }}
      searchPlaceholder='Search artifacts…'
      searchLeftSection={
        <>
          {sourceDropdown}
          {fileTypeDropdown}
        </>
      }
      statStrip={
        <Box
          sx={(theme) => ({
            borderTop: `1px solid ${theme.colors.dark[5]}`,
            borderBottom: `1px solid ${theme.colors.dark[5]}`,
            padding: '6px 4px',
            display: 'flex',
            gap: 0,
          })}
        >
          {/* Chat group */}
          <Box
            sx={(theme) => ({
              borderRight: `1px solid ${theme.colors.dark[5]}`,
              paddingRight: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
            })}
          >
            <Group spacing={6} align='baseline' noWrap>
              <Text size='sm' weight={600} color={(artifactStats?.chat ?? 0) > 0 ? 'cyan' : 'dark.3'}>
                {artifactStatsLoading ? '–' : (artifactStats?.chat ?? 0).toLocaleString()}
              </Text>
              <Text size='xs' color='dimmed'>from chats</Text>
            </Group>
            <Group spacing={16} noWrap pl={8}>
              <Group spacing={4} align='baseline' noWrap>
                <Text size='xs' weight={500} color='dark.2'>
                  {artifactStatsLoading ? '–' : (artifactStats?.chatArtifacts.byCreationMethod.modelOnly.total ?? 0).toLocaleString()}
                </Text>
                <Text size='xs' color='dark.3'>LLM models</Text>
              </Group>
              <Group spacing={4} align='baseline' noWrap>
                <Text size='xs' weight={500} color='dark.2'>
                  {artifactStatsLoading ? '–' : (artifactStats?.chatArtifacts.byCreationMethod.agentProvider.total ?? 0).toLocaleString()}
                </Text>
                <Text size='xs' color='dark.3'>Agent Providers</Text>
              </Group>
            </Group>
          </Box>

          {/* Workflows */}
          <Box sx={{ paddingLeft: 16, display: 'flex', alignItems: 'center' }}>
            <Group spacing={6} align='baseline' noWrap>
              <Text size='sm' weight={600} color={(artifactStats?.workflow ?? 0) > 0 ? 'cyan' : 'dark.3'}>
                {artifactStatsLoading ? '–' : (artifactStats?.workflow ?? 0).toLocaleString()}
              </Text>
              <Text size='xs' color='dimmed'>from workflows</Text>
            </Group>
          </Box>
        </Box>
      }
    >
      {isPending && allRows.length === 0 ? (
        <Center h={120}><Loader size='sm' /></Center>
      ) : !artifactStats && !isPending ? (
        <Text size='sm' color='dimmed' py='xl' align='center'>No artifact data available</Text>
      ) : (
        <Stack spacing='md'>
          <>
            {isFetching ? (
              <Center h={120}><Loader size='sm' /></Center>
            ) : filteredRows.length === 0 && !isPending ? (
              <Text size='sm' color='dimmed' py='xl' align='center'>No artifacts found</Text>
            ) : (
              <>
                <Table
                  fontSize='xs'
                  verticalSpacing='xs'
                  highlightOnHover
                  sx={(theme) => ({
                    '& tbody tr:hover': { backgroundColor: theme.colors.dark[4] },
                  })}
                >
                  <thead>
                    <tr>
                      <th>Owner</th>
                      <th>File name</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <HeaderInfoPopover
                          label='$ Cost/Token count'
                          align='right'
                          width={280}
                          description={
                            <Stack spacing={4}>
                              <Text size='xs' color='gray.4'>
                                The cost of just the step that produced this artifact — a single chat message if it came from a
                                conversation, or a single step if it came from a workflow.
                              </Text>
                              <Text size='xs' color='gray.5'>
                                Compare with{' '}
                                <Text component='span' color='green.5' fw={600}>Cumulative Token/Cost</Text> to see the full
                                cost of everything leading up to it.
                              </Text>
                            </Stack>
                          }
                        />
                      </th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <HeaderInfoPopover
                          label='Cumulative Token/Cost'
                          align='right'
                          width={300}
                          description={
                            <Stack spacing={4}>
                              <Text size='xs' color='gray.4'>
                                LLM cost of every prior message or step, plus embedding cost — RAG query embeddings, and
                                document ingestion for chats — through this artifact&apos;s step.
                              </Text>
                              <Text size='xs' color='gray.5'>
                                Compare with{' '}
                                <Text component='span' color='cyan.4' fw={600}>$ Cost/Token count</Text> to see the cost of
                                just this step.
                              </Text>
                            </Stack>
                          }
                        />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row, i) => {
                      const { color, icon: Icon } = getFileTypeConfig(row.name);
                      return (
                        <tr key={i}>
                          <td>
                            <Text size='xs'>{row.userName}</Text>
                          </td>
                          <td>
                            <Group spacing={6} noWrap>
                              <ThemeIcon size={14} c={color} variant='transparent' style={{ flexShrink: 0 }}>
                                <Icon size={14} stroke={2} />
                              </ThemeIcon>
                              <Text size='xs'>{row.name}</Text>
                            </Group>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            <SpendCell cost={row.cost} tokens={row.tokens} />
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            <SpendCell cost={row.cumulativeCost} tokens={row.cumulativeTokens} color='green.5' />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                {totalPages > 1 && (
                  <Pagination
                    total={totalPages}
                    value={page}
                    onChange={setPage}
                    position='right'
                    size='sm'
                    mt='md'
                  />
                )}
              </>
            )}
          </>

          {/* Pie charts: one set per artifact source, since Chat and Workflow
              are unrelated pipelines with their own file types and creation
              methods — Workflow has only the one, AI-provider-powered, method. */}
          <Stack spacing={6}>
            <Text size='xs' weight={700} color='dimmed' sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Chat artifacts
            </Text>
            <SimpleGrid cols={2} spacing='sm'>
              {renderArtifactsByTypeChart('By File Type', artifactStats?.chatArtifacts.byType ?? [], chatTotal)}
              <Box
                sx={(theme) => ({
                  padding: '10px 14px',
                  borderRadius: theme.radius.sm,
                  border: `1px solid ${theme.colors.dark[4]}`,
                })}
              >
                <Text size='sm' weight={700} color='gray.1' mb={8}>By Creation Method</Text>
                {chatCreationMethodSections.length === 0 ? (
                  <Center h={180}><Text size='xs' color='dimmed'>No data</Text></Center>
                ) : (
                  <Group position='center' align='center'>
                    <RingProgress
                      size={180}
                      thickness={20}
                      sections={chatCreationMethodSections.map((s) => ({
                        value: chatTotal > 0 ? (s.value / chatTotal) * 100 : 0,
                        color: s.color,
                        tooltip: `${s.label}: ${s.value} (${chatTotal > 0 ? ((s.value / chatTotal) * 100).toFixed(1) : 0}%)`,
                      }))}
                      label={
                        <Stack spacing={0} align='center'>
                          <Text size='lg' weight={700}>{chatTotal}</Text>
                          <Text size='xs' color='dimmed'>Total</Text>
                        </Stack>
                      }
                    />
                    <Stack spacing={4}>
                      {chatCreationMethodSections.map((s) => (
                        <Group key={s.label} spacing={6} noWrap>
                          <Box sx={(theme) => ({ width: 10, height: 10, borderRadius: 2, flexShrink: 0, backgroundColor: theme.colors[s.color][6] })} />
                          <Text size='xs' weight={500}>{s.label}</Text>
                          <Text size='xs' color='dimmed'>{s.value}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </Group>
                )}
              </Box>
            </SimpleGrid>

            <Text size='xs' weight={700} color='dimmed' mt='sm' sx={{ textTransform: 'uppercase', letterSpacing: 0.4 }}>
              Workflow artifacts
            </Text>
            <SimpleGrid cols={2} spacing='sm'>
              {renderArtifactsByTypeChart('By File Type', artifactStats?.workflowArtifacts.byType ?? [], workflowTotal)}
            </SimpleGrid>
          </Stack>
        </Stack>
      )}
    </SectionCard>
  );
}

// ─── Prompts section ──────────────────────────────────────────────────────────

type PromptsSectionProps = {
  promptStats: PromptStats | undefined;
  workflowStats: WorkflowStats | undefined;
  workflowLoading: boolean;
  loading: boolean;
};

function PromptsSection({ promptStats, workflowStats, workflowLoading, loading }: PromptsSectionProps) {
  const statItems: StatItem[] = [
    { value: promptStats?.library.created, label: 'created', loading },
    { value: promptStats?.library.chatted, label: 'started chats', loading },
    { value: promptStats?.library.bookmarked, label: 'bookmarked', loading },
    { value: promptStats?.library.uniqueTags, label: 'unique tags', loading },
    { value: workflowStats?.executions, label: 'workflow executions', loading: workflowLoading },
    // App-wide, not library- or workflow-attributable — see PromptStats.llmCalls.
    { value: promptStats?.llmCalls, label: 'LLM calls (all surfaces)', loading },
  ];

  return (
    <SectionCard
      icon={<IconPencil size={16} />}
      title='Prompts'
      statStrip={<StatStrip stats={statItems} />}
    >
      {loading ? (
        <Center h={80}><Loader size='sm' /></Center>
      ) : !promptStats ? (
        <Text size='sm' color='dimmed' py='md' align='center'>No prompt data available</Text>
      ) : (
        <Stack spacing='md'>
          {/* Library + Workflow summary rows */}
          <SimpleGrid cols={2} spacing='sm'>
            <Box
              sx={(theme) => ({
                padding: '10px 14px',
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.dark[4]}`,
              })}
            >
              <Text size='sm' weight={700} color='gray.1' mb={8}>Prompt Library</Text>
              <Stack spacing={3}>
                <Group position='apart'>
                  <Text size='xs' color='dimmed'>Created</Text>
                  <Text size='xs' weight={600}>{promptStats.library.created.toLocaleString()}</Text>
                </Group>
                <Group position='apart'>
                  <Text size='xs' color='dimmed'>Started chats</Text>
                  <Text size='xs' weight={600}>{promptStats.library.chatted.toLocaleString()}</Text>
                </Group>
                <Group position='apart'>
                  <Text size='xs' color='dimmed'>Bookmarked</Text>
                  <Text size='xs' weight={600}>{promptStats.library.bookmarked.toLocaleString()}</Text>
                </Group>
                <Group position='apart'>
                  <Text size='xs' color='dimmed'>Unique tags</Text>
                  <Text size='xs' weight={600}>{promptStats.library.uniqueTags.toLocaleString()}</Text>
                </Group>
                {/* Prompts authored via the Prompt Generator. There is no
                    library-prompt execution count to show here: LogEntry has no
                    promptId, so an execution cannot be tied back to a prompt. */}
                <Group position='apart'>
                  <Text size='xs' color='dimmed' weight={600}>Generated</Text>
                  <Text size='xs' weight={700} color='cyan'>{promptStats.generated.toLocaleString()}</Text>
                </Group>
              </Stack>
            </Box>
            <Box
              sx={(theme) => ({
                padding: '10px 14px',
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.dark[4]}`,
              })}
            >
              <Text size='sm' weight={700} color='gray.1' mb={8}>Workflows</Text>
              {workflowLoading ? (
                <Stack spacing={3}>
                  <Skeleton height={14} />
                  <Skeleton height={14} />
                </Stack>
              ) : (
                <Stack spacing={3}>
                  <Group position='apart'>
                    <Text size='xs' color='dimmed'>Created</Text>
                    <Text size='xs' weight={600}>{(workflowStats?.total ?? 0).toLocaleString()}</Text>
                  </Group>
                  <Group position='apart'>
                    <Text size='xs' color='dimmed' weight={600}>Executions</Text>
                    <Text size='xs' weight={700}>{(workflowStats?.executions ?? 0).toLocaleString()}</Text>
                  </Group>
                  <Group position='apart'>
                    <Text size='xs' color='dimmed'>Shared</Text>
                    <Text size='xs' weight={600}>{(workflowStats?.shared ?? 0).toLocaleString()}</Text>
                  </Group>
                  <Group position='apart'>
                    <Text size='xs' color='dimmed' weight={600}>Succeeded</Text>
                    <Text size='xs' weight={700} color='cyan'>{(workflowStats?.successful ?? 0).toLocaleString()}</Text>
                  </Group>
                </Stack>
              )}
            </Box>
          </SimpleGrid>

          {/* Pie charts */}
          <SimpleGrid cols={2} spacing='sm'>
            <Box
              sx={(theme) => ({
                padding: '10px 14px',
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.dark[4]}`,
              })}
            >
              <Text size='sm' weight={700} color='gray.1' mb={8}>Prompts by Tag</Text>
              <MermaidPieChart
                title='Prompts by Tag'
                slices={[
                  ...promptStats.library.byTag.map((t) => ({ label: t.tag, value: t.count })),
                  ...(promptStats.library.tagless > 0 ? [{ label: 'Tagless', value: promptStats.library.tagless }] : []),
                ]}
              />
            </Box>
            <Box
              sx={(theme) => ({
                padding: '10px 14px',
                borderRadius: theme.radius.sm,
                border: `1px solid ${theme.colors.dark[4]}`,
              })}
            >
              <Text size='sm' weight={700} color='gray.1' mb={8}>Prompts Used in Chats</Text>
              <MermaidPieChart
                title='Prompts Used in Chats'
                slices={[
                  { label: 'Used to start chat', value: promptStats.library.chatted },
                  { label: 'Not used in chat', value: Math.max(0, promptStats.library.created - promptStats.library.chatted) },
                ].filter((s) => s.value > 0)}
              />
            </Box>
          </SimpleGrid>

        </Stack>
      )}
    </SectionCard>
  );
}
