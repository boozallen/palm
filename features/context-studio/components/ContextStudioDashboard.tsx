import { Fragment, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
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
import { notifications } from '@mantine/notifications';
import { trpc } from '@/libs';
import {
  IconBrush,
  IconDownload,
  IconFileText,
  IconGridDots,
  IconInfoCircle,
  IconMessageCircle,
  IconPencil,
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
import useGetConversationToolStats from '@/features/context-studio/api/get-conversation-tool-stats';
import useGetAgentProposalJobs from '@/features/context-studio/api/get-agent-proposal-jobs';
import useGetArtifactStats from '@/features/context-studio/api/get-artifact-stats';
import useGetPageTransitions from '@/features/context-studio/api/get-page-transitions';
import useGetUserActivity from '@/features/context-studio/api/get-user-activity';
import useSearchChats from '@/features/context-studio/api/search-chats';
import AgentsPanel from './panels/AgentsPanel';
import StudioPanel from './sections/StudioPanel';
import PageTransitions from './sections/PageTransitions';
import UserActivityTimeline from './sections/UserActivityTimeline';
import GraphStatsCard from './sections/GraphStatsCard';
import UserGroupsCard from './sections/UserGroupsCard';
import KnowledgeGraphSection from './sections/KnowledgeGraphSection';
import LoginActivitySection from './sections/UserActivitySection';
import CostSection from './sections/cost/CostSection';
import ConversationToolsSection from './sections/ConversationToolsSection';
import ValueSection from './sections/value/ValueSection';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';
import {
  type ChatMessageRecord,
  MessageBubble,
  CostBreakdownCard,
  aggregateUsageSteps,
} from './ChatTranscript';
import HoverPopover from './HoverPopover';
import { formatDuration, formatTokens } from '@/features/context-studio/utils/valueFormat';
import useSearchDocuments from '@/features/context-studio/api/search-documents';
import useSearchUsers from '@/features/context-studio/api/search-users';
import useSearchArtifacts from '@/features/context-studio/api/search-artifacts';
import { getFileTypeConfig } from '@/features/chat/utils/chatHelperFunctions';
import { convertMarkdownToDocx } from '@/features/chat/utils/artifacts/convertMarkdownToDocx';
import { convertMarkdownToExcel } from '@/features/chat/utils/artifacts/convertMarkdownToXlsx';
import { BINARY_FILE_DOWNLOAD_MAP } from '@/features/shared/types/document';
import { UserRole } from '@/features/shared/types/user';
import {
  ArtifactStats,
  contextStudioQuerySchema,
  ContextStudioQuery,
  DocumentStats,
  PageTransitionStats,
  PromptStats,
  TimeRange,
  UserTrailStats,
  WorkflowStats,
} from '@/features/context-studio/types/context-studio';
import {
  ChatSearchQuery,
  chatSearchInitialValues,
  DocumentSearchQuery,
  documentSearchInitialValues,
} from '@/features/context-studio/types/chat-search';
import {
  UserSearchQuery,
  userSearchInitialValues,
} from '@/features/context-studio/types/user-search';
import {
  ArtifactSearchQuery,
  artifactSearchInitialValues,
} from '@/features/context-studio/types/artifact-search';

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
type StudioTab = 'value' | 'activity' | 'conversations' | 'knowledge' | 'ai-agents' | 'people' | 'cost';

const STUDIO_TABS: { value: StudioTab; label: string }[] = [
  { value: 'value', label: 'Value' },
  { value: 'activity', label: 'Activity' },
  { value: 'conversations', label: 'Conversations' },
  { value: 'knowledge', label: 'Knowledge' },
  { value: 'ai-agents', label: 'AI Agents' },
  { value: 'people', label: 'People' },
  { value: 'cost', label: 'Cost' },
];

// These tabs show org-wide breakdowns (adoption story, login/session activity,
// the user roster, agent/service usage) rather than cost data scoped to a
// group — a Lead's authority over their own group doesn't extend to them.
const ADMIN_ONLY_TABS: StudioTab[] = ['value', 'activity', 'ai-agents', 'people'];

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

type ChatSessionVisitRecord = {
  enteredAt: string | Date;
  leftAt: string | Date;
  durationMs: number;
};

// Null when no click-based navigation into the chat was ever recorded — see
// ChatSessionLength in the chat-search types. Null means unknown, not zero.
type ChatSessionLengthRecord = {
  totalDurationMs: number;
  visits: ChatSessionVisitRecord[];
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
  sessionLength: ChatSessionLengthRecord | null;
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

type ArtifactSearchRecord = {
  id: string;
  name: string;
  source: 'chat' | 'workflow';
  userName: string | null;
  workflowName: string | null;
  createdAt: string | Date;
  cost: number | null;
  tokens: number | null;
  cumulativeCost: number | null;
  cumulativeTokens: number | null;
  sizeBytes: number | null;
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

// Tolerates a missing size — an artifact predating size tracking, or one
// whose content has since been cleared — by rendering an em dash.
const formatBytes = (bytes: number | null): string => {
  if (bytes === null || !Number.isFinite(bytes)) { return '—'; }
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(1)} MB`;
  }
  if (bytes >= 1_000) {
    return `${(bytes / 1_000).toFixed(1)} KB`;
  }
  return `${bytes} B`;
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

// The record set backing the table is capped at the search endpoints' 1000-row
// `pageSize` limit, so an export whose filters match more rows than that needs
// to walk every page rather than exporting just what's already loaded.
async function fetchAllPages<T>(
  totalCount: number,
  pageSize: number,
  fetchPage: (page: number) => Promise<{ records: T[] }>,
): Promise<T[]> {
  const pageCount = Math.ceil(totalCount / pageSize);
  const pages = await Promise.all(
    Array.from({ length: pageCount }, (_, i) => fetchPage(i + 1)),
  );
  return pages.flatMap((p) => p.records);
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function ContextStudioDashboard() {
  const router = useRouter();
  const track = useTrackClientEvent();
  const session = useSession();
  const isAdmin = session.data?.user.role === UserRole.Admin;
  const [excludeAdmins, setExcludeAdmins] = useState(false);
  const [filters, setFilters] = useState<ContextStudioQuery>(INITIAL_FILTERS);

  // Value/Activity/AI Agents/People are Admin-only, so a Lead or plain member
  // never even sees those tabs in the strip.
  const visibleTabs = isAdmin
    ? STUDIO_TABS
    : STUDIO_TABS.filter((tab) => !ADMIN_ONLY_TABS.includes(tab.value));

  // The tab lives in the URL so a view is linkable and survives a refresh. The
  // query param is the source of truth; an unknown value, or one this viewer
  // can't see, falls back to Value for an Admin (the exec read they should
  // land on) or Conversations for everyone else, rather than rendering an
  // Admin-only panel a non-Admin reached by editing the URL.
  const activeTab: StudioTab =
    visibleTabs.find((tab) => tab.value === router.query.tab)?.value ??
      (isAdmin ? 'value' : 'conversations');

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
  const onValue = activeTab === 'value';
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
  const agentProposalJobs = useGetAgentProposalJobs(filters.timeRange, filters.userGroupId, filters.userId, onAgents);
  const workflowStats = useGetWorkflowStats(filters.timeRange, filters.userGroupId, filters.userId, onConversations || onAgents);
  const graphStats = useGetGraphStats(filters.timeRange, filters.userGroupId, filters.userId, onKnowledge);
  const userActivityStats = useGetUserActivityStats(filters.timeRange, filters.userGroupId, filters.userId, excludeAdmins, onActivity || onPeople);
  const agentServiceStats = useGetAgentServiceStats(filters.timeRange, filters.userGroupId, filters.userId, onAgents);
  const conversationToolStats = useGetConversationToolStats(filters.timeRange, filters.userGroupId, filters.userId, excludeAdmins, onConversations);
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
        {/* Cost has no admin filter and Value excludes admins unconditionally —
            on both, the switch would be a control that changes nothing. */}
        {!onCost && !onValue && (
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
          {visibleTabs.map((tab) => (
            <Tabs.Tab
              key={tab.value}
              value={tab.value}
              data-testid={`context-studio-${tab.value}-tab`}
            >
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {/* Value — the exec read: adoption, work products, how many were put to
            work, and what it cost. Placed first because a funding decision-maker
            should land on the story rather than on tab seven. */}
        <Tabs.Panel value='value' pt='lg' style={{ border: 'none' }}>
          <ValueSection
            timeRange={filters.timeRange}
            userGroupId={filters.userGroupId}
            userId={filters.userId}
            enabled={onValue}
          />
        </Tabs.Panel>

        {/* Activity — how people move through the app, from whole sessions down
            to a single user's trail. */}
        <Tabs.Panel value='activity' pt='lg' style={{ border: 'none' }}>
          <Stack spacing='lg'>
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
            <PageTransitionsSection
              stats={pageTransitionStats.data}
              loading={pageTransitionStats.isFetching}
              failed={pageTransitionStats.isError}
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
            <ConversationToolsSection
              conversationToolStats={conversationToolStats.data}
              conversationToolStatsLoading={conversationToolStats.isFetching}
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
            agentProposalJobs={agentProposalJobs.data}
            agentProposalJobsLoading={agentProposalJobs.isFetching}
            agentProposalJobsFailed={agentProposalJobs.isError}
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
  const [isExporting, setIsExporting] = useState(false);

  const [queryParams, setQueryParams] = useState<ChatSearchQuery>({
    ...chatSearchInitialValues,
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

  const utils = trpc.useUtils();

  // `isPending` rather than `isFetching`: a disabled (tab-gated) query reports
  // `isFetching: false` with no data, indistinguishable from a finished query
  // that found nothing — pending keeps the loader up instead of flashing empty.
  const { data, isFetching, isPending } = useSearchChats({ ...queryParams, page, pageSize: CHAT_PAGE_SIZE }, enabled);
  const records = (data?.records ?? []) as ChatRecord[];
  const totalCount = data?.totalCount ?? 0;
  const artifactsGenerated = data?.artifactsGeneratedCount ?? 0;
  const withUploadedSources = data?.citedDocumentsCount ?? 0;
  const documentCitations = data?.documentCitationsCount ?? 0;
  const graphAnchorCitations = data?.graphAnchorCitationsCount ?? 0;

  const totalPages = Math.ceil(totalCount / CHAT_PAGE_SIZE);

  // The table only ever holds one page's worth of records, so export walks
  // every page of the matching set (at the search endpoint's 1000-row cap)
  // rather than exporting just what's currently on screen.
  const handleDownload = async () => {
    if (!totalCount) { return; }
    setIsExporting(true);
    try {
      const allRecords = await fetchAllPages<ChatRecord>(totalCount, 1000, (p) =>
        utils.contextStudio.searchChats.fetch({ ...queryParams, page: p, pageSize: 1000 }));
      const header = 'Date,User,Email,Summary,Documents,Citations (RAG),Citations (GraphRAG),Generated Artifacts,Cost,Tokens';
      const rows = allRecords.map((r) => {
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
    } finally {
      setIsExporting(false);
    }
  };

  const statItems: StatItem[] = [
    { value: totalCount, label: 'conversations', loading: isPending },
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
      downloadDisabled={!totalCount || isExporting}
      statStrip={<StatStrip stats={statItems} />}
    >
      <ConversationsTable
        records={records}
        totalRecords={totalCount}
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
            <th>Time Spent</th>
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
                        <Text size='xs' color='dimmed'>{formatDate(record.createdAt)}</Text>
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
                      <td>
                        <SessionLengthCell sessionLength={record.sessionLength} />
                      </td>
                    </Box>
                  }
                >
                  <Text size='xs'>{isExpanded ? 'Click to collapse transcript' : 'Click to reveal transcript'}</Text>
                </HoverPopover>
                {expandedId === record.id && (
                  <tr key={`${record.id}-expanded`}>
                    <td colSpan={9} style={{ padding: 0 }}>
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

function SessionLengthCell({ sessionLength }: { sessionLength: ChatSessionLengthRecord | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!sessionLength || sessionLength.visits.length === 0) {
    return <Text size='xs' color='dark.3' data-testid='session-length-empty'>—</Text>;
  }

  const { totalDurationMs, visits } = sessionLength;
  const hasSubSessions = visits.length > 1;

  return (
    <Stack spacing={2} data-testid='session-length-cell'>
      <Group spacing={6} noWrap>
        <Text size='xs' data-testid='session-length-total'>{formatDuration(totalDurationMs)}</Text>
        {hasSubSessions && (
          <Text
            size='xs'
            color='dimmed'
            data-testid='session-length-toggle'
            sx={{ cursor: 'pointer' }}
            onClick={(e: React.MouseEvent) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? 'Hide visits' : `${visits.length} visits`}
          </Text>
        )}
      </Group>
      {expanded && hasSubSessions && (
        <Stack spacing={2} pl={4} data-testid='session-length-visits'>
          {visits.map((visit, i) => (
            <Text key={i} size='xs' color='gray.5' data-testid='session-length-visit'>
              {formatTimestamp(visit.enteredAt)} · {formatDuration(visit.durationMs)}
            </Text>
          ))}
        </Stack>
      )}
    </Stack>
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
    <Stack spacing={2} maw={160}>
      {visible.map((item, i) => {
        const { color, icon: Icon } = getFileTypeConfig(item);
        return (
          <Group key={i} spacing={6} noWrap sx={{ minWidth: 0 }}>
            <ThemeIcon size={14} c={color} variant='transparent' style={{ flexShrink: 0 }}>
              <Icon size={14} stroke={2} />
            </ThemeIcon>
            <Text size='xs' color='gray.4' truncate sx={{ minWidth: 0 }}>{item}</Text>
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
    <Stack spacing={2} maw={160}>
      {visible.map((item, i) => {
        const { color, icon: Icon } = getFileTypeConfig(item.filename);
        return (
          <Group key={i} spacing={6} noWrap sx={{ minWidth: 0 }}>
            <ThemeIcon size={14} c={color} variant='transparent' style={{ flexShrink: 0 }}>
              <Icon size={14} stroke={2} />
            </ThemeIcon>
            <Text size='xs' color='gray.4' truncate style={{ flex: 1, minWidth: 0 }}>{item.filename}</Text>
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
  const [isExporting, setIsExporting] = useState(false);

  const [queryParams, setQueryParams] = useState<DocumentSearchQuery>({
    ...documentSearchInitialValues,
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

  const utils = trpc.useUtils();

  // See ConversationsSection: pending covers the gated-and-not-yet-started case
  // that `isFetching` alone reports as an empty result.
  const { data, isFetching, isPending } = useSearchDocuments(
    { ...queryParams, fileType: selectedType ?? undefined, page, pageSize: DOC_PAGE_SIZE },
    enabled,
  );
  const records = (data?.records ?? []) as DocumentRecord[];
  const totalCount = data?.totalCount ?? 0;

  // Breakdown across the whole matching set (ignoring the type filter itself),
  // not just the current page — see searchDocuments's typeCounts.
  const typeEntries = Object.entries(data?.typeCounts ?? {}).sort((a, b) => b[1] - a[1]);

  const totalPages = Math.ceil(totalCount / DOC_PAGE_SIZE);

  // See ConversationsSection: export walks every page of the matching set,
  // ignoring the type filter — same as the pre-pagination export's behavior.
  const handleDownload = async () => {
    if (!totalCount) { return; }
    setIsExporting(true);
    try {
      const allRecords = await fetchAllPages<DocumentRecord>(totalCount, 1000, (p) =>
        utils.contextStudio.searchDocuments.fetch({ ...queryParams, page: p, pageSize: 1000 }));
      const header = 'Document,Owner,Uploaded,Summary';
      const rows = allRecords.map((r) => {
        const date = new Date(r.createdAt).toLocaleDateString();
        const summary = (r.summary ?? '').replace(/,/g, ';').replace(/\n/g, ' ');
        return `"${r.filename}","${r.userName ?? ''}",${date},"${summary}"`;
      });
      downloadCsv([header, ...rows].join('\n'), 'documents.csv');
    } finally {
      setIsExporting(false);
    }
  };

  const statItems: StatItem[] = [
    { value: totalCount, label: 'documents uploaded', loading: isPending },
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
      downloadDisabled={!totalCount || isExporting}
      statStrip={<StatStrip stats={statItems} />}
    >
      <DocumentsTable
        records={records}
        totalRecords={totalCount}
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
  const [isExporting, setIsExporting] = useState(false);

  const [queryParams, setQueryParams] = useState<UserSearchQuery>({
    ...userSearchInitialValues,
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

  const utils = trpc.useUtils();

  // See ConversationsSection: pending covers the gated-and-not-yet-started case
  // that `isFetching` alone reports as an empty result.
  const { data, isFetching, isPending } = useSearchUsers({ ...queryParams, page, pageSize: USER_PAGE_SIZE }, enabled);
  const records = (data?.records ?? []) as UserRecord[];
  const totalCount = data?.totalCount ?? 0;
  const groupMemberCount = data?.groupMemberCount ?? 0;
  const totalSpend = data?.totalSpend ?? 0;
  const totalTokens = data?.totalTokens ?? 0;

  const totalPages = Math.ceil(totalCount / USER_PAGE_SIZE);

  // See ConversationsSection: export walks every page of the matching set
  // rather than exporting just the page currently on screen.
  const handleDownload = async () => {
    if (!totalCount) { return; }
    setIsExporting(true);
    try {
      const allRecords = await fetchAllPages<UserRecord>(totalCount, 1000, (p) =>
        utils.contextStudio.searchUsers.fetch({ ...queryParams, page: p, pageSize: 1000 }));
      const header = 'User,Email,Role,Last Login,Group Memberships,Lifetime Spend (USD),Lifetime Tokens';
      const rows = allRecords.map((r) => {
        const lastLogin = r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString() : 'Never';
        return `"${r.name ?? ''}","${r.email ?? ''}",${r.role},${lastLogin},${r.groupCount},${r.spend.toFixed(2)},${r.tokens}`;
      });
      downloadCsv([header, ...rows].join('\n'), 'users.csv');
    } finally {
      setIsExporting(false);
    }
  };

  const statItems: StatItem[] = [
    { value: totalCount, label: 'users', loading: isPending },
    { value: groupMemberCount, label: 'in at least 1 user group', loading: isPending },
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
      downloadDisabled={!totalCount || isExporting}
      statStrip={
        <Group position='apart' align='center' noWrap>
          <StatStrip stats={statItems} />
          <Text size='xs' color='dimmed'>
            {`Totals across ${totalCount.toLocaleString()} user${totalCount === 1 ? '' : 's'}: `}
            <Text component='span' weight={600} color='cyan'>{formatSpend(totalSpend)}</Text>
            {` · ${formatTokens(totalTokens)} tokens`}
          </Text>
        </Group>
      }
    >
      <UsersTable
        records={records}
        totalRecords={totalCount}
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
  const utils = trpc.useUtils();
  const track = useTrackClientEvent();
  const [search, setSearch] = useState('');
  const [debouncedSearch] = useDebouncedValue(search, 400);
  const [selectedSource, setSelectedSource] = useState<string>('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [page, setPage] = useState(1);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [queryParams, setQueryParams] = useState<ArtifactSearchQuery>({
    ...artifactSearchInitialValues,
    timeRange: filters.timeRange as ArtifactSearchQuery['timeRange'],
    userGroupId: filters.userGroupId,
    userId: filters.userId,
    excludeAdmins,
  });

  useEffect(() => {
    setQueryParams((prev) => ({
      ...prev,
      timeRange: filters.timeRange as ArtifactSearchQuery['timeRange'],
      userGroupId: filters.userGroupId,
      userId: filters.userId,
      excludeAdmins,
      search: debouncedSearch || undefined,
    }));
    setPage(1);
  }, [filters, excludeAdmins, debouncedSearch]);

  // See ConversationsSection: pending covers the gated-and-not-yet-started case
  // that `isFetching` alone reports as an empty result.
  const { data, isFetching: artifactsFetching, isPending: artifactsPending } = useSearchArtifacts(
    {
      ...queryParams,
      source: selectedSource === 'chat' || selectedSource === 'workflow' ? selectedSource : undefined,
      fileType: selectedType || undefined,
      page,
      pageSize: ARTIFACT_PAGE_SIZE,
    },
    enabled,
  );
  const records = (data?.records ?? []) as ArtifactSearchRecord[];
  const totalCount = data?.totalCount ?? 0;

  // Breakdown across both sources under the shared filters only — see
  // searchArtifacts's typeCounts — not the search text, source, or type filter.
  const typeEntries = Object.entries(data?.typeCounts ?? {}).sort((a, b) => b[1] - a[1]);

  const totalPages = Math.ceil(totalCount / ARTIFACT_PAGE_SIZE);

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

  const isFetching = artifactsFetching || artifactStatsLoading;
  // Drives the loader and empty states; `isFetching` still drives the dimming,
  // which should only apply to a refetch that is genuinely in flight.
  const isPending = artifactsPending || artifactStatsLoading;

  // The route enforces ownership (or Lead-of-owner's-group) for non-Admins, so this
  // just renders whatever content comes back. Binary content decodes straight to a
  // Blob; text content goes through the same markdown converters chat/workflow
  // downloads already use.
  const handleDownloadArtifact = async (row: ArtifactSearchRecord) => {
    setDownloadingId(row.id);
    try {
      const artifact = await utils.contextStudio.getArtifactContent.fetch({ source: row.source, id: row.id });
      if (!artifact) {
        notifications.show({ title: 'Download failed', message: 'This artifact is no longer available', color: 'red' });
        return;
      }

      let blob: Blob;
      if (artifact.binaryContent) {
        const binaryString = atob(artifact.binaryContent);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) { bytes[i] = binaryString.charCodeAt(i); }
        const contentType = BINARY_FILE_DOWNLOAD_MAP[artifact.fileExtension.toLowerCase()] ?? 'application/octet-stream';
        blob = new Blob([bytes], { type: contentType });
      } else {
        const text = artifact.content ?? '';
        switch (artifact.fileExtension) {
          case '.docx':
            try {
              blob = await convertMarkdownToDocx(text);
            } catch {
              blob = new Blob([text], { type: 'text/plain' });
            }
            break;
          case '.xlsx':
            try {
              blob = await convertMarkdownToExcel(text);
            } catch {
              blob = new Blob([text], { type: 'text/plain' });
            }
            break;
          case '.pptx':
            try {
              const { convertMarkdownToPptx } = await import('@/features/chat/utils/artifacts/convertMarkdownToPptx');
              blob = await convertMarkdownToPptx(text);
            } catch {
              blob = new Blob([text], { type: 'text/plain' });
            }
            break;
          default:
            blob = new Blob([text], { type: 'text/plain' });
            break;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = row.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (row.source === 'chat') {
        track.download.chatArtifact({ id: row.id, label: row.name, fileExtension: '' }, null);
      } else {
        track.download.workflowArtifact({ artifactId: row.id, filename: row.name });
      }
    } catch {
      notifications.show({ title: 'Download failed', message: 'Could not download this artifact. Please try again.', color: 'red' });
    } finally {
      setDownloadingId(null);
    }
  };

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
      {isPending && totalCount === 0 ? (
        <Center h={120}><Loader size='sm' /></Center>
      ) : !artifactStats && !isPending ? (
        <Text size='sm' color='dimmed' py='xl' align='center'>No artifact data available</Text>
      ) : (
        <Stack spacing='md'>
          <>
            {isFetching ? (
              <Center h={120}><Loader size='sm' /></Center>
            ) : totalCount === 0 && !isPending ? (
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
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Size</th>
                      <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }} data-testid='artifacts-cost-token-header'>
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
                    {records.map((row) => {
                      const { color, icon: Icon } = getFileTypeConfig(row.name);
                      return (
                        <tr key={row.id}>
                          <td>
                            <Text size='xs'>{row.userName}</Text>
                          </td>
                          <td>
                            <Group spacing={6} noWrap>
                              <Tooltip label='Download' withArrow position='top'>
                                <ActionIcon
                                  size='sm'
                                  loading={downloadingId === row.id}
                                  onClick={() => handleDownloadArtifact(row)}
                                  data-testid={`artifact-download-${row.id}`}
                                  aria-label='Download artifact'
                                  style={{ flexShrink: 0 }}
                                >
                                  <IconDownload size={14} stroke={1.5} />
                                </ActionIcon>
                              </Tooltip>
                              <ThemeIcon size={14} c={color} variant='transparent' style={{ flexShrink: 0 }}>
                                <Icon size={14} stroke={2} />
                              </ThemeIcon>
                              <Text size='xs'>{row.name}</Text>
                            </Group>
                          </td>
                          <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>
                            <Text size='xs' color='dimmed' data-testid={`artifact-size-${row.id}`}>{formatBytes(row.sizeBytes)}</Text>
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
