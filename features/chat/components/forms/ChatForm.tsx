import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useForm } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/router';
import { IconX, IconVector, IconNetwork, IconPlus, IconMessageCode, IconFiles } from '@tabler/icons-react';
import { Box, Group, SegmentedControl, Tooltip, Menu, ActionIcon, Badge } from '@mantine/core';

import { useChat } from '@/features/chat/providers/ChatProvider';
import { QueryScope } from '@/features/chat/types/message';
import { generateUrl } from '@/features/chat/utils/chatHelperFunctions';
import MessageInput from '@/features/chat/components/forms/MessageInput';
import SubmitButton from '@/features/chat/components/forms/SubmitButton';
import ChatModelSelect from '@/features/chat/components/ChatModelSelect';
import ChatDeepResearchButton from '@/features/chat/components/ChatDeepResearchButton';
import ChatVoiceDictationButton from '@/features/chat/components/ChatVoiceDictationButton';
import QueryScopeSelect from '@/features/chat/components/forms/QueryScopeSelect';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { useGetBedrockModelAccess } from '@/features/shared/api/get-bedrock-model-access';
import useCreateChat from '@/features/chat/api/create-chat';
import useAddMessage from '@/features/chat/api/add-message';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';
import useUpdateChatConversationSummary from '@/features/chat/api/update-chat-conversation-summary';
import { appendSelectedTextToUserMessage } from '@/features/chat/utils/selectedTextHelperFunctions';
import { usePiiDetection } from '@/features/shared/hooks/piiDetection/usePiiDetection';
import PiiDetectionModal from '@/features/shared/components/modals/piiDetectionModal';
import useGetUserKnowledgeBases from '@/features/shared/api/get-user-knowledge-bases';
import { useGetUserGraphDatabaseAccess } from '@/features/shared/api/get-user-graph-database-access';
import { useGetUserAgenticChatAccess } from '@/features/shared/api/get-user-agentic-chat-access';
import { useGetGraphedDocuments } from '@/features/graph-database/api/get-graphed-documents';
import { StartHereTrigger } from '@/features/chat/components/StartHereGuide/StartHereTrigger';
import { StartHereWalkthrough } from '@/features/chat/components/StartHereGuide/StartHereWalkthrough';
import useStartHereState from '@/features/chat/components/StartHereGuide/useStartHereState';
import useIsAwaitingChatResponse from '@/features/chat/hooks/useIsAwaitingChatResponse';

export type ChatFormValues = {
  message: string;
};

type ChatFormProps = Readonly<{
  /** Lets the parent hide the rest of the empty state while the walkthrough covers the input. */
  onStartHereExpandedChange?: (expanded: boolean) => void;
}>;

export default function ChatForm({ onStartHereExpandedChange }: ChatFormProps = {}) {
  const createChat = useCreateChat();
  const {
    chatId,
    modelId,
    promptId,
    setChatId,
    pendingMessage,
    setPendingMessage,
    isLastMessageRetry,
    knowledgeBaseIds,
    documentIds,
    deepResearchEnabled,
    setDeepResearchEnabled,
    systemMessage,
    selectedText,
    setSelectedText,
    sourcesSidebarExpanded,
    setSourcesSidebarExpanded,
    useGraph,
    setUseGraph,
    showGraphTooltip,
    graphedSourceIds,
    setHasUserSubmittedMessageInSession,
    enumerationTabs,
    activeEnumerationTabId,
    queryScope,
    graphCanvasSelectedEntityIds,
    graphDisplayedEntityIds,
    prefilledMessage,
    setPrefilledMessage,
    autoSubmitMessage,
    setAutoSubmitMessage,
    setShowSystemEntry,
    setTriggerEditSystemPrompt,
    setMessageInputHasText,
    setHasUserInteracted,
    showKnowledgeGraph,
    showArtifactsContainer,
    selectedArtifact,
  } = useChat();

  const isCompact = sourcesSidebarExpanded || showKnowledgeGraph || showArtifactsContainer || !!selectedArtifact;
  const sidebarOnlyOpen = sourcesSidebarExpanded && !showKnowledgeGraph && !showArtifactsContainer && !selectedArtifact;

  // The Start Here guide only lives on the empty chat state.
  const isEmptyState = chatId === null;
  const {
    hasSeen: startHereSeen,
    expanded: startHereExpanded,
    expand: expandStartHere,
    collapse: collapseStartHere,
  } = useStartHereState({ enabled: isEmptyState });

  useEffect(() => {
    onStartHereExpandedChange?.(startHereExpanded);
  }, [startHereExpanded, onStartHereExpandedChange]);

  const activeTab = enumerationTabs.find(t => t.id === activeEnumerationTabId);

  const queryGraphEntityIds = useMemo(() => {
    switch (queryScope) {
      case QueryScope.DOCUMENT:
        return [];
      case QueryScope.TABLE: {
        if (!activeTab) {
          return [];
        }
        const ids = activeTab.data.nodeMapping.flatMap(m => m.entityIds);
        return [...new Set(ids)];
      }
      case QueryScope.GRAPH:
        return [...new Set(graphDisplayedEntityIds)];
      case QueryScope.GRAPH_SELECTION:
        return [...graphCanvasSelectedEntityIds];
      default:
        return [];
    }
  }, [queryScope, activeTab, graphDisplayedEntityIds, graphCanvasSelectedEntityIds]);

  const graphScopeSource = useMemo(() => {
    switch (queryScope) {
      case QueryScope.DOCUMENT:
        return 'document';
      case QueryScope.TABLE:
        return activeTab
          ? `table:"${activeTab.label}" (${activeTab.data.rowCount} rows, ${queryGraphEntityIds.length} entities)`
          : 'table:none';
      case QueryScope.GRAPH:
        return `graph (${queryGraphEntityIds.length} entities)`;
      case QueryScope.GRAPH_SELECTION:
        return `graph-selection (${queryGraphEntityIds.length} entities)`;
      default:
        return 'unknown';
    }
  }, [queryScope, activeTab, queryGraphEntityIds.length]);

  const { data: models } = useGetAvailableModels();
  const { data: systemConfig } = useGetSystemConfig();
  const { data: bedrockModelAccess } = useGetBedrockModelAccess();
  const { data: userGraphDatabaseAccess } = useGetUserGraphDatabaseAccess();
  const { data: userAgenticChatAccess } = useGetUserAgenticChatAccess();
  const { data: userKnowledgeBases } = useGetUserKnowledgeBases();
  const { data: graphedDocumentsData } = useGetGraphedDocuments();

  const effectiveGraphedSourceIds = [
    ...new Set([
      ...graphedSourceIds,
      ...(graphedDocumentsData?.documentIds ?? []),
    ]),
  ];

  const hasAnySelectedDocGraphed = documentIds.some(
    (id) => effectiveGraphedSourceIds.includes(id)
  );

  const addMessage = useAddMessage();

  const promptQry = useGetOriginPrompt(promptId);
  const updateChatConversationSummary = useUpdateChatConversationSummary();

  const initialValues: ChatFormValues = {
    message: '',
  };

  const form = useForm<ChatFormValues>({
    initialValues,
  });

  useEffect(() => {
    if (!promptQry.isPending && promptQry.isFetched && promptQry.data) {
      if (chatId === null) {
        form.setValues({ message: promptQry.data.prompt.example });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptQry.isPending, promptQry.isFetched, promptQry.data]);

  useEffect(() => {
    if (prefilledMessage) {
      form.setFieldValue('message', prefilledMessage);
      setPrefilledMessage(null);
      setMessageInputHasText(true);
      setHasUserInteracted(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefilledMessage]);

  useEffect(() => {
    if (autoSubmitMessage) {
      form.setFieldValue('message', autoSubmitMessage);
      setAutoSubmitMessage(null);
      setTimeout(() => {
        formRef.current?.requestSubmit();
      }, 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSubmitMessage]);

  const formRef = useRef<HTMLFormElement | null>(null);

  const router = useRouter();

  // Reset the form when navigating to a fresh chat.
  useEffect(() => {
    const handleRouteChange = (url: string) => {
      if (url === '/chat') {
        form.reset();
      }
    };

    router.events.on('routeChangeStart', handleRouteChange);
    return () => {
      router.events.off('routeChangeStart', handleRouteChange);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.events]);

  const onSubmit = async (values: ChatFormValues) => {
    const userMessage = values.message.trim();
    const fullMessage = appendSelectedTextToUserMessage(
      selectedText,
      userMessage,
    );

    await submitWithPiiCheck(fullMessage, () => submitMessage(fullMessage));
  };

  const submitMessage = async (fullMessage: string) => {
    // Non-deep-research chat processes asynchronously via worker.
    const isAsyncChat = !deepResearchEnabled;

    form.reset();
    setSelectedText(null);
    setHasUserSubmittedMessageInSession(true);

    try {
      if (modelId === null) {
        return;
      }
      // Skip for async chat since the backend creates the real placeholder.
      if (!isAsyncChat) {
        setPendingMessage(fullMessage);
      }

      let chatIdToUse = chatId ?? '';
      if (chatId === null) {
        const chat = await createChat.mutateAsync({
          modelId,
          promptId,
          systemMessage: systemMessage,
        });
        chatIdToUse = chat.chat.id;
      }

      const isGraphScoped =
        queryScope === QueryScope.GRAPH || queryScope === QueryScope.GRAPH_SELECTION;
      const graphSnapshotPayload =
        isGraphScoped && graphDisplayedEntityIds.length > 0
          ? {
              nodeIds: [...graphDisplayedEntityIds],
              documentIds: [...documentIds],
            }
          : undefined;

      const addedMessages = await addMessage
        .mutateAsync({
          chatId: chatIdToUse,
          message: fullMessage,
          knowledgeBaseIds,
          documentIds,
          deepResearchEnabled,
          useGraph,
          graphEntityIds: queryGraphEntityIds,
          graphScopeSource,
          graphSnapshot: graphSnapshotPayload,
        }).then((result) => {
          if (chatId === null) {
            updateChatConversationSummary.mutate({ ...result });
            setChatId(chatIdToUse);
          }

          const url = generateUrl(
            chatIdToUse,
            knowledgeBaseIds,
            documentIds,
            promptQry?.data?.prompt.title,
            sourcesSidebarExpanded,
            useGraph
          );

          router.replace(url, undefined, {
            shallow: true,
          });

          return result;
        });

      if (deepResearchEnabled) {
        setDeepResearchEnabled(false);
      }

      if (addedMessages.failedKbs?.length) {
        notifications.show({
          title: 'Some Knowledge Bases Could Not Be Accessed',
          message: 'The following knowledge bases could not be accessed: ' + addedMessages.failedKbs.join(', '),
          icon: <IconX />,
          autoClose: false,
          withCloseButton: true,
          variant: 'failed_operation',
        });
      }

      if (!isAsyncChat) {
        setPendingMessage(null);
      }
    } catch (error) {
      notifications.show({
        title: 'Failed to Add Message to Chat',
        message: 'An unexpected error occurred. Please try again later.',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
      if (!isAsyncChat) {
        setPendingMessage(null);
      }
    }
  };

  const handleSubmit = async () => {
    await onSubmit(form.values);
  };

  // The addMessage mutation resolves once the job is queued, so mutation state alone
  // stops covering the window where the worker is still generating the response.
  const isAwaitingResponse = useIsAwaitingChatResponse(chatId);
  const isPending = createChat.isPending || addMessage.isPending || isAwaitingResponse;
  const isDisabled =
    isPending ||
    modelId === null ||
    pendingMessage !== null ||
    isLastMessageRetry;

  let tooltipMessage = '';
  const AGENT_PROVIDER_PREFIX = 'agent-provider::';
  const isAgentProviderSelected = typeof modelId === 'string' && modelId.startsWith(AGENT_PROVIDER_PREFIX);

  if (isLastMessageRetry) {
    tooltipMessage = 'An unexpected error occurred. Please retry the last message to continue.';
  } else if (chatId === null) {
    if (models?.availableModels.length === 0 && !isAgentProviderSelected) {
      tooltipMessage = 'There are currently no large language models available to chat with. Please contact your administrator to get access.';
    }
  } else if (!isAgentProviderSelected && (!modelId || !models?.availableModels.find((m) => m.id === modelId))) {
    tooltipMessage = 'The model used for this chat is no longer available. Please begin a new chat.';
  }
  const isSubmitDisabled = isDisabled || !modelId || !!tooltipMessage || form.values.message === '';

  const { submitWithPiiCheck, isModalOpen, detectedPii, onContinue, onClose } = usePiiDetection();

  const handleVoiceTranscript = useCallback((text: string) => {
    const current = form.values.message;
    const separator = current && !current.endsWith(' ') ? ' ' : '';
    form.setFieldValue('message', current + separator + text);
  }, [form]);

  const selectedSourcesCount = (knowledgeBaseIds?.length || 0) + (documentIds?.length || 0);
  const documentUploadProviderId = systemConfig?.documentLibraryDocumentUploadProviderId || '';
  const hasKnowledgeBases = (userKnowledgeBases?.userKnowledgeBases?.length ?? 0) > 0;
  const awsBedrockAccess = bedrockModelAccess?.hasAccess || false;
  const displaySourcesElements = hasKnowledgeBases || (documentUploadProviderId && awsBedrockAccess);

  const toggleSourcesSidebar = () => {
    setSourcesSidebarExpanded(!sourcesSidebarExpanded);
  };

  return (
    <>
      <form onSubmit={form.onSubmit(onSubmit)} ref={formRef}>
        <Box bg='dark.7'>
          <Box
            p='md'
            style={!isCompact || sidebarOnlyOpen
              ? { maxWidth: 860, marginLeft: 'auto', marginRight: 'auto', width: '100%' }
              : {}}
          >
            {startHereExpanded ? (
              <StartHereWalkthrough onClose={collapseStartHere} />
            ) : (
            <Box bg='dark.5' sx={{ borderRadius: '8px' }}>
              <MessageInput
                form={form}
                handleSubmit={handleSubmit}
                isDisabled={isDisabled}
              />

              <Group
                position='apart'
                bg='dark.5'
                px='md'
                pb='md'
                style={{
                  borderBottomLeftRadius: isEmptyState ? undefined : '8px',
                  borderBottomRightRadius: isEmptyState ? undefined : '8px',
                }}
              >
                <Group spacing='xxs' style={{ flexWrap: 'nowrap' }}>
                  <Menu position={chatId ? 'top-start' : 'bottom-start'} withinPortal>
                    <Menu.Target>
                      <ActionIcon variant='subtle' size='sm' color='gray.5' mb='-sm' ml='-xs'>
                        <IconPlus size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      {displaySourcesElements && (
                        <Menu.Item
                          icon={<IconFiles size={16} />}
                          onClick={toggleSourcesSidebar}
                          rightSection={selectedSourcesCount > 0 ? (
                            <Badge size='sm' variant='filled' color='cyan' style={{ minWidth: 18, padding: '4px 4px', marginLeft: 6 }}>{selectedSourcesCount}</Badge>
                          ) : undefined}
                        >
                          Add data sources
                        </Menu.Item>
                      )}
                      <Menu.Item
                        icon={<IconMessageCode size={16} />}
                        onClick={() => {
                          setShowSystemEntry(true);
                          setTriggerEditSystemPrompt(true);
                        }}
                      >
                        Edit system persona
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                  <ChatDeepResearchButton />
                  {displaySourcesElements && userGraphDatabaseAccess?.hasAccess && !userAgenticChatAccess?.hasAccess && (
                    <SegmentedControl
                      data-testid='use-graph-toggle'
                      mt='xs'
                      value={useGraph ? 'graph-enhanced' : 'vector'}
                      onChange={(value) => {
                        // Only allow graph-enhanced search if a selected document is graphed.
                        if (value === 'graph-enhanced' && !hasAnySelectedDocGraphed) {
                          return;
                        }
                        setUseGraph(value === 'graph-enhanced');
                      }}
                      data={[
                        {
                          label: (
                            <Tooltip label='Vector search' zIndex={1000} withinPortal>
                              <IconVector size={16} />
                            </Tooltip>
                          ),
                          value: 'vector',
                        },
                        {
                          label: (
                            <Tooltip
                              label={
                                !hasAnySelectedDocGraphed
                                  ? 'Generate a graph first to enable graph-enhanced search'
                                  : showGraphTooltip
                                  ? 'Graph-enhanced search now available'
                                  : 'Graph-enhanced search'
                              }
                              opened={showGraphTooltip ? true : undefined}
                              zIndex={1000}
                              withinPortal
                              events={{ hover: true, focus: true, touch: true }}
                            >
                              <Box component='span' style={{ display: 'inline-flex', pointerEvents: !hasAnySelectedDocGraphed ? 'all' : 'auto' }}>
                                <IconNetwork size={16} style={{ opacity: !hasAnySelectedDocGraphed ? 0.5 : 1 }} />
                              </Box>
                            </Tooltip>
                          ),
                          value: 'graph-enhanced',
                          disabled: !hasAnySelectedDocGraphed,
                        },
                      ]}
                    />
                  )}
                  {useGraph && (
                    <QueryScopeSelect />
                  )}
                </Group>

                <Group spacing='sm' style={{ flexWrap: 'nowrap' }}>
                  <ChatModelSelect />

                  <ChatVoiceDictationButton onTranscript={handleVoiceTranscript} />

                  <SubmitButton
                    isSubmitDisabled={isSubmitDisabled}
                    isPending={isPending}
                    handleSubmit={handleSubmit}
                    tooltipMessage={tooltipMessage}
                    isTooltipDisabled={!tooltipMessage}
                  />
                </Group>
              </Group>

              {isEmptyState && (
                <StartHereTrigger hasSeen={startHereSeen} onExpand={expandStartHere} />
              )}
            </Box>
            )}
          </Box>
        </Box>
      </form>
      <PiiDetectionModal
        modalOpened={isModalOpen}
        closeModalHandler={onClose}
        onContinue={onContinue}
        piiMatches={detectedPii}
      />
    </>
  );
}
