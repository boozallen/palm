import { Avatar, Box, Title, Text, Stack, UnstyledButton, Divider, Card, Group, HoverCard, ThemeIcon, keyframes } from '@mantine/core';
import {
  IconClipboardText,
  IconRobot,
  IconMessageCircle,
  IconBookmark,
  IconClock,
  IconSparkles,
} from '@tabler/icons-react';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { useSession } from 'next-auth/react';

import { useGetPrompts } from '@/features/library/api/get-prompts';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetAvailableAgentProviders from '@/features/shared/api/get-available-agent-providers';
import useGetChats from '@/features/chat/api/get-chats';
import useGetChatMetadata from '@/features/chat/api/get-chat-metadata';
import type { ChatMetadata } from '@/features/chat/dal/getChatMetadata';
import { useGreeting, generatePath, formatRelativeChatTime, getFileTypeConfig } from '@/features/chat/utils/chatHelperFunctions';

const fadeUp = keyframes({
  from: { opacity: 0, transform: 'translateY(8px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
});

const AGENT_PROVIDER_PREFIX = 'agent-provider::';

type PromptBadge = 'most_chatted' | 'most_bookmarked' | 'recent';

const BADGE_CONFIG: Record<PromptBadge, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  most_chatted: {
    label: 'Most Chatted',
    icon: <IconMessageCircle size={11} />,
    color: '#74c476',
    bg: 'rgba(55, 100, 55, 0.45)',
  },
  most_bookmarked: {
    label: 'Most Bookmarked',
    icon: <IconBookmark size={11} />,
    color: '#d4a44c',
    bg: 'rgba(100, 75, 25, 0.45)',
  },
  recent: {
    label: 'Most Recent',
    icon: <IconClock size={11} />,
    color: '#74b9ff',
    bg: 'rgba(30, 60, 110, 0.5)',
  },
};

const MAX_DISPLAYED_ARTIFACT_ICONS = 3;

function ChatArtifactIcons({ artifacts }: { artifacts: ChatMetadata['artifacts'] }) {
  const displayedArtifacts = artifacts.slice(0, MAX_DISPLAYED_ARTIFACT_ICONS);
  const remainingCount = artifacts.length - displayedArtifacts.length;

  return (
    <Avatar.Group spacing={4}>
      {displayedArtifacts.map((artifact) => {
        const { color, icon: Icon } = getFileTypeConfig(artifact.fileExtension);
        return (
          <HoverCard key={artifact.id} shadow='md' position='bottom-start' withinPortal>
            <HoverCard.Target>
              <Avatar data-testid={`chat-artifact-icon-${artifact.id}`} variant='transparent' radius='xl' size='xs'>
                <ThemeIcon size={11} c={color} variant='transparent'>
                  <Icon size={11} stroke={2} />
                </ThemeIcon>
              </Avatar>
            </HoverCard.Target>
            <HoverCard.Dropdown>
              <Text size='xs' color='gray.7'>{artifact.label}{artifact.fileExtension}</Text>
            </HoverCard.Dropdown>
          </HoverCard>
        );
      })}
      {remainingCount > 0 && (
        <Avatar data-testid='chat-artifact-icon-overflow' variant='transparent' radius='xl' size='xs'>
          <Text size={9} color='gray.4'>+{remainingCount}</Text>
        </Avatar>
      )}
    </Avatar.Group>
  );
}

type SuggestionRowProps = {
  icon?: React.ReactNode;
  label: string;
  trailing?: string;
  badge?: PromptBadge;
  stats?: { usageCount: number; bookmarkCount: number };
  chatMeta?: ChatMetadata;
  onClick: () => void;
  variant?: 'action' | 'prompt' | 'chat';
  testId?: string;
  animationDelay?: number;
};

function SuggestionRow({ icon, label, trailing, badge, stats, chatMeta, onClick, variant = 'action', testId, animationDelay = 0 }: SuggestionRowProps) {
  const isChat = variant === 'chat';
  const isPrompt = variant === 'prompt' || isChat;
  const badgeCfg = badge ? BADGE_CONFIG[badge] : null;
  return (
    <UnstyledButton
      data-testid={testId}
      onClick={onClick}
      sx={(theme) => ({
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: '9px 12px',
        borderRadius: 8,
        backgroundColor: isPrompt ? theme.colors.dark[7] : 'transparent',
        animation: `${fadeUp} 350ms ease both`,
        animationDelay: `${animationDelay}ms`,
        '&:hover': {
          backgroundColor: isPrompt ? theme.colors.dark[6] : theme.colors.dark[7],
        },
      })}
    >
      {icon && (
        <Box sx={(theme) => ({ color: theme.colors.gray[4], display: 'flex', flexShrink: 0 })}>
          {icon}
        </Box>
      )}
      <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
        <Text
          size='sm'
          truncate
          sx={(theme) => ({
            color: isPrompt ? theme.colors.gray[2] : theme.colors.gray[3],
            fontWeight: isChat ? theme.other.fontWeights.bold : undefined,
            minWidth: 0,
          })}
        >
          {label}
        </Text>
        {badgeCfg && (
          <Box
            data-testid={badge ? `badge-${badge}` : undefined}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              backgroundColor: badgeCfg.bg,
              borderRadius: 999,
              padding: '2px 7px',
              flexShrink: 0,
            }}
          >
            <Box sx={{ color: badgeCfg.color, display: 'flex', alignItems: 'center' }}>
              {badgeCfg.icon}
            </Box>
            <Text sx={{ color: badgeCfg.color, fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {badgeCfg.label}
            </Text>
          </Box>
        )}
        {stats && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <Box sx={(theme) => ({ display: 'flex', alignItems: 'center', gap: 3, color: theme.colors.gray[5] })}>
              <IconMessageCircle size={11} />
              <Text sx={(theme) => ({ fontSize: '11px', color: theme.colors.gray[5] })}>
                {stats.usageCount}
              </Text>
            </Box>
            <Box sx={(theme) => ({ display: 'flex', alignItems: 'center', gap: 3, color: theme.colors.gray[5] })}>
              <IconBookmark size={11} />
              <Text sx={(theme) => ({ fontSize: '11px', color: theme.colors.gray[5] })}>
                {stats.bookmarkCount}
              </Text>
            </Box>
          </Box>
        )}
        {chatMeta && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {(chatMeta.agentProviderName || chatMeta.modelName) && (
              <Text
                sx={(theme) => ({
                  fontSize: '11px',
                  color: theme.colors.gray[5],
                  backgroundColor: theme.colors.dark[5],
                  borderRadius: 999,
                  padding: '2px 7px',
                  whiteSpace: 'nowrap',
                })}
              >
                {chatMeta.agentProviderName || chatMeta.modelName}
              </Text>
            )}
            {chatMeta.messageCount > 0 && (
              <Box sx={(theme) => ({ display: 'flex', alignItems: 'center', gap: 3, color: theme.colors.gray[5] })}>
                <IconMessageCircle size={11} />
                <Text sx={(theme) => ({ fontSize: '11px', color: theme.colors.gray[5] })}>
                  {chatMeta.messageCount}
                </Text>
              </Box>
            )}
            {chatMeta.artifacts.length > 0 && (
              <ChatArtifactIcons artifacts={chatMeta.artifacts} />
            )}
          </Box>
        )}
        {trailing && (
          <Text sx={(theme) => ({ fontSize: '11px', color: theme.colors.gray[5], flexShrink: 0, whiteSpace: 'nowrap', marginLeft: 'auto' })}>
            {trailing}
          </Text>
        )}
      </Box>
    </UnstyledButton>
  );
}

export default function EmptyChatSuggestions() {
  const {
    hasUserInteracted,
    hasUserSubmittedMessageInSession,
    showAgentOnboarding,
  } = useChat();

  if (showAgentOnboarding && !hasUserSubmittedMessageInSession) {
    return (
      <Card
        data-testid='agent-onboarding'
        p='xl'
        radius='md'
        sx={(theme) => ({
          backgroundColor: theme.colors.dark[6],
          border: `1px solid ${theme.colors.blue[8]}`,
        })}
      >
        <Stack spacing='md'>
          <Group spacing='sm'>
            <Box
              sx={(theme) => ({
                width: 48,
                height: 48,
                borderRadius: theme.radius.md,
                backgroundColor: theme.colors.blue[9],
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: theme.colors.blue[4],
                flexShrink: 0,
              })}
            >
              <IconRobot size={28} />
            </Box>
            <Stack spacing={4}>
              <Text weight={600} size='xl' color='white'>
                PRD Generator Agent
              </Text>
              <Text size='sm' color='dimmed'>
                Custom agent for product requirements documents
              </Text>
            </Stack>
          </Group>

          <Text size='sm' color='gray.4'>
            This specialized agent helps you create comprehensive product requirements documents (PRDs).
            It will guide you through defining product features, user stories, technical specifications,
            and success metrics.
          </Text>

          <Text size='sm' color='gray.4'>
            Please be aware that it is crucial to only utilize non-sensitive information when using the PRD Generator Agent.
            Users are fully responsible for all application usage and the data shared when using this agent.
            Do not input any sensitive or classified data. CUI, PII, PHI, and other sensitive data types are not permitted.
            Entrusted, Booz Allen internal, and unclassified data is permitted.
            If you are unsure whether data is sensitive or classified, consult your organization&apos;s policies before proceeding.
          </Text>

          <Stack spacing='xs'>
            <Text size='sm' weight={600} color='white'>
              Getting Started:
            </Text>
            <Text size='sm' color='gray.4'>• Describe your product idea or feature</Text>
            <Text size='sm' color='gray.4'>• Specify your target audience and use cases</Text>
            <Text size='sm' color='gray.4'>• Mention any technical constraints or requirements</Text>
          </Stack>

          <Text size='sm' color='gray.5' mt='sm'>
            Type your product idea in the message box below to begin.
          </Text>
        </Stack>
      </Card>
    );
  }

  if (hasUserInteracted || hasUserSubmittedMessageInSession) {
    return null;
  }

  return null;
}

export function ChatGreeting() {
  const { hasUserInteracted, hasUserSubmittedMessageInSession, showAgentOnboarding, messageInputHasText } = useChat();
  const { data: session } = useSession();
  const greeting = useGreeting(session?.user?.name);

  if (hasUserInteracted || hasUserSubmittedMessageInSession || showAgentOnboarding || messageInputHasText) {
    return null;
  }

  return (
    <Box
      pb='sm'
      sx={{
        width: '100%',
        textAlign: 'center',
        animation: `${fadeUp} 250ms ease both`,
      }}
    >
      <Box sx={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
        <Box sx={(theme) => ({ color: theme.colors.blue[6], display: 'flex', flexShrink: 0 })}>
          <IconSparkles size={30} />
        </Box>
        <Title size={32} weight={600} color='gray.3' data-testid='empty-state-heading'>
          {greeting}
        </Title>
      </Box>
    </Box>
  );
}

const STAGGER_BASE_MS = 300;
const STAGGER_STEP_MS = 80;

// Recent chats and library prompts share this many rows, chats taking priority.
const LIBRARY_SLOT_COUNT = 3;

// Badges used by the hidden placeholder rows so their reserved height matches the loaded rows.
const PLACEHOLDER_BADGES: PromptBadge[] = ['most_chatted', 'most_bookmarked', 'recent'];

export function ChatEmptySuggestions() {
  const router = useRouter();
  const {
    setPrefilledMessage,
    setModelId,
    setShowAgentOnboarding,
    hasUserInteracted,
    hasUserSubmittedMessageInSession,
    showAgentOnboarding,
    messageInputHasText,
    sourcesSidebarExpanded,
    showKnowledgeGraph,
    showArtifactsContainer,
    selectedArtifact,
  } = useChat();

  const isCompact = sourcesSidebarExpanded || showKnowledgeGraph || showArtifactsContainer || !!selectedArtifact;
  const sidebarOnlyOpen = sourcesSidebarExpanded && !showKnowledgeGraph && !showArtifactsContainer && !selectedArtifact;

  const { data: allPromptsData, isPending: promptsIsPending } = useGetPrompts({});
  const { data: agentProviderData } = useGetAvailableAgentProviders();
  const { data: chatsData, isPending: chatsIsPending } = useGetChats();

  const hasAgentProviders = (agentProviderData?.availableAgentProviders?.length ?? 0) > 0;
  const firstAgentProvider = agentProviderData?.availableAgentProviders[0];

  // Three distinct library slots: most-chatted, most-bookmarked, most-recent.
  // Falls back to successive prompts from the list when stats are zero.
  const librarySlots = useMemo(() => {
    if (!allPromptsData?.prompts?.length) {
      return [];
    }
    const { prompts, stats } = allPromptsData;
    const used = new Set<string>();
    const slots: Array<{ id: string; title: string; badge: PromptBadge; stats: { usageCount: number; bookmarkCount: number } }> = [];

    // Slot 1: most chatted
    const byChatted = [...prompts].sort((a, b) => (stats?.[b.id]?.usageCount || 0) - (stats?.[a.id]?.usageCount || 0));
    const mostChatted = byChatted.find(p => !used.has(p.id) && (stats?.[p.id]?.usageCount || 0) > 0)
      ?? byChatted.find(p => !used.has(p.id));
    if (mostChatted) {
      slots.push({ id: mostChatted.id, title: mostChatted.title, badge: 'most_chatted', stats: { usageCount: stats?.[mostChatted.id]?.usageCount || 0, bookmarkCount: stats?.[mostChatted.id]?.bookmarkCount || 0 } });
      used.add(mostChatted.id);
    }

    // Slot 2: most bookmarked
    const byBookmarked = [...prompts].sort((a, b) => (stats?.[b.id]?.bookmarkCount || 0) - (stats?.[a.id]?.bookmarkCount || 0));
    const mostBookmarked = byBookmarked.find(p => !used.has(p.id) && (stats?.[p.id]?.bookmarkCount || 0) > 0)
      ?? byBookmarked.find(p => !used.has(p.id));
    if (mostBookmarked) {
      slots.push({ id: mostBookmarked.id, title: mostBookmarked.title, badge: 'most_bookmarked', stats: { usageCount: stats?.[mostBookmarked.id]?.usageCount || 0, bookmarkCount: stats?.[mostBookmarked.id]?.bookmarkCount || 0 } });
      used.add(mostBookmarked.id);
    }

    // Slot 3: most recent (by list order, which is insertion order from the library)
    // TODO: use user's most recently used prompt when recency signal is available
    const recent = prompts.find(p => !used.has(p.id));
    if (recent) {
      slots.push({ id: recent.id, title: recent.title, badge: 'recent', stats: { usageCount: stats?.[recent.id]?.usageCount || 0, bookmarkCount: stats?.[recent.id]?.bookmarkCount || 0 } });
    }

    return slots;
  }, [allPromptsData]);

  const totalPromptCount = allPromptsData?.prompts?.length ?? 0;
  // Always render 3 library rows so the layout height is stable while the query loads.
  const isPending = promptsIsPending || chatsIsPending;

  // Recent chats take priority over the library slots, most-recently-updated first.
  const recentChats = useMemo(() => {
    if (!chatsData?.chats?.length) {
      return [];
    }
    return [...chatsData.chats]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, LIBRARY_SLOT_COUNT);
  }, [chatsData]);

  const recentChatIds = useMemo(() => recentChats.map((chat) => chat.id), [recentChats]);
  const { data: chatMetadataData } = useGetChatMetadata(recentChatIds);
  const chatMetadataById = useMemo(() => {
    const map = new Map<string, ChatMetadata>();
    chatMetadataData?.metadata.forEach((entry) => map.set(entry.chatId, entry));
    return map;
  }, [chatMetadataData]);

  const promptSlots = librarySlots.slice(0, Math.max(LIBRARY_SLOT_COUNT - recentChats.length, 0));
  const showLibrarySection = isPending || recentChats.length > 0 || promptSlots.length > 0;
  const showBrowseLink = !isPending && promptSlots.length > 0 && totalPromptCount > 0;

  if (hasUserInteracted || (showAgentOnboarding && !hasUserSubmittedMessageInSession) || messageInputHasText) {
    return null;
  }

  const handleGeneratePRD = () => {
    if (hasAgentProviders && firstAgentProvider) {
      setModelId(`${AGENT_PROVIDER_PREFIX}${firstAgentProvider.id}`);
      setShowAgentOnboarding(true);
    } else {
      setPrefilledMessage('Create a product requirements document (PRD) for: [describe your product or feature here]. Include sections for problem statement, goals, user stories, technical requirements, and success metrics.');
    }
  };

  return (
    <Box
      px='md'
      mt={0}
      style={!isCompact || sidebarOnlyOpen
        ? { maxWidth: 860, marginLeft: 'auto', marginRight: 'auto', width: '100%' }
        : {}}
    >
      <Stack spacing={0} align='flex-start'>
        <SuggestionRow
          icon={<IconClipboardText size={16} />}
          label='Generate a PRD'
          onClick={handleGeneratePRD}
          testId='suggestion-generate-prd'
          animationDelay={STAGGER_BASE_MS}
        />

        {showLibrarySection && (
          <>
            <Divider
              mx='smmd'
              my='xs'
              sx={(theme) => ({
                borderColor: theme.colors.dark[5],
                animation: `${fadeUp} 350ms ease both`,
                animationDelay: `${STAGGER_BASE_MS + STAGGER_STEP_MS}ms`,
                alignSelf: 'stretch',
              })}
            />
            {isPending
              ? Array.from({ length: LIBRARY_SLOT_COUNT }).map((_, index) => (
                // Render the real row markup but hidden, so the reserved height
                // matches the loaded rows exactly and the input never shifts.
                <Box key={index} aria-hidden sx={{ visibility: 'hidden', alignSelf: 'stretch' }}>
                  <SuggestionRow
                    label='Loading'
                    badge={PLACEHOLDER_BADGES[index] ?? 'recent'}
                    stats={{ usageCount: 0, bookmarkCount: 0 }}
                    onClick={() => undefined}
                    variant='prompt'
                  />
                </Box>
              ))
              : (
                <>
                  {recentChats.map((chat, index) => (
                    <SuggestionRow
                      key={chat.id}
                      icon={<IconMessageCircle size={16} />}
                      label={chat.summary || 'New chat'}
                      trailing={formatRelativeChatTime(chat.updatedAt)}
                      chatMeta={chatMetadataById.get(chat.id)}
                      onClick={() => router.push(generatePath(chat.id))}
                      variant='chat'
                      testId={`suggestion-recent-chat-${chat.id}`}
                      animationDelay={STAGGER_BASE_MS + STAGGER_STEP_MS * (index + 2)}
                    />
                  ))}
                  {promptSlots.map((slot, index) => (
                    <SuggestionRow
                      key={slot.id}
                      label={slot.title}
                      badge={slot.badge}
                      stats={slot.stats}
                      onClick={() => router.push(`/chat?promptid=${slot.id}`)}
                      variant='prompt'
                      testId={`suggestion-library-${slot.badge}`}
                      animationDelay={STAGGER_BASE_MS + STAGGER_STEP_MS * (recentChats.length + index + 2)}
                    />
                  ))}
                </>
              )
            }
          </>
        )}
      </Stack>

      {(isPending || showBrowseLink) && (
        <UnstyledButton
          data-testid='browse-all-prompts'
          onClick={showBrowseLink ? () => router.push('/library') : undefined}
          sx={(theme) => ({
            display: 'block',
            marginTop: 10,
            paddingLeft: 12,
            fontSize: '11.5px',
            color: theme.colors.dark[2],
            visibility: showBrowseLink ? 'visible' : 'hidden',
            animation: `${fadeUp} 350ms ease both`,
            animationDelay: `${STAGGER_BASE_MS + STAGGER_STEP_MS * (LIBRARY_SLOT_COUNT + 3)}ms`,
            '&:hover': {
              color: theme.colors.gray[4],
            },
          })}
        >
          Browse all {totalPromptCount} prompts →
        </UnstyledButton>
      )}
    </Box>
  );
}
