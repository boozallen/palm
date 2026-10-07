import { useMemo } from 'react';
import { Entries, EntryType, MessageEntry, SkeletonEntry } from '@/features/chat/types/entry';
import { MessageRole, DeepResearchStatus, AsyncChatStatus, ContextType, GraphSearchResultData } from '@/features/chat/types/message';
import { DefaultSystemMessage } from '@/features/shared/utils';
import useGetMessages from '@/features/chat/api/get-messages';
import useGetOriginPrompt from '@/features/chat/api/get-origin-prompt';
import { filterHandlesToGraph } from '@/features/chat/utils/graphCitationHelpers';

/**
 * Filter out graph citations, keeping only document/KB citations for display
 */
function filterDocumentCitations(citations: any[]): any[] {
  return citations.filter(
    (c) => c.contextType === ContextType.DOCUMENT_LIBRARY ||
      c.contextType === ContextType.KNOWLEDGE_BASE ||
      c.contextType === ContextType.PRIOR_CONVERSATION
  );
}

export default function useFormatChatEntries(
  chatId: string | null,
  promptId: string | null,
  pendingMessage: string | null,
  systemMessage: string | null,
  regeneratingResponse: boolean
) {
  const messagesQry = useGetMessages(chatId);
  const promptQry = useGetOriginPrompt(promptId);

  const entries = useMemo(() => {
    const entries: Entries = [];

    // Create appropriate placeholder or skeleton based on prompt loading state
    let placeholder: MessageEntry | null = null;
    let systemSkeleton: SkeletonEntry | null = null;
    
    if (promptId && promptQry.isPending) {
      // Show skeleton while loading prompt data (only if we have a promptId)
      systemSkeleton = {
        id: 'system-skeleton',
        chatId: chatId ?? '',
        type: EntryType.Skeleton,
        role: MessageRole.System,
        createdAt: new Date(0),
      };
    } else if (promptId && promptQry.isFetched && promptQry.data) {
      // Use prompt instructions when available
      const { prompt } = promptQry.data;
      placeholder = {
        id: 'placeholder',
        chatId: chatId ?? '',
        type: EntryType.Message,
        role: MessageRole.System,
        content: prompt.instructions,
        deepResearch: false,
        createdAt: new Date(0),
      };
    } else {
      // Show default system message (when no promptId or when prompt query failed)
      placeholder = {
        id: 'placeholder',
        chatId: chatId ?? '',
        type: EntryType.Message,
        role: MessageRole.System,
        content: systemMessage ?? DefaultSystemMessage,
        deepResearch: false,
        createdAt: new Date(0),
      };
    }

    // Use data if available, regardless of query state (handles cache populated by setData)
    if (messagesQry.data) {
      const { messages: msgs } = messagesQry.data;

      // Check if there's a system message in the data
      const hasSystemMessage = msgs.some(msg => msg.role === MessageRole.System);
      if (!hasSystemMessage) {
        if (systemSkeleton) {
          // Add skeleton if we're still loading prompt data
          entries.push(systemSkeleton);
        } else if (placeholder) {
          // Add the system placeholder if no system message exists in the data and we have a placeholder
          // This handles the case where cache is populated via mutation (which doesn't include system msg)
          entries.push(placeholder);
        }
      }

      for (let msg of msgs) {
        // Skip failed async messages - RetryEntry will be shown via the lastMessage check below
        if (msg.asyncChatStatus === AsyncChatStatus.ERROR) {
          continue;
        }

        // The synthesis-time evidence subgraph entry (if any). Carries the marked answer text +
        // handle map for interactive citations; absent on legacy/non-graph answers.
        const evidenceResult = Array.isArray(msg.graphSearchResult)
          ? msg.graphSearchResult.find((d) => d.kind === 'evidence')
          : undefined;

        entries.push({
          id: msg.id,
          chatId: chatId ?? '',
          type: EntryType.Message,
          role: msg.role as MessageRole,
          content: msg.content,
          citations: filterDocumentCitations(msg.citations),
          hasEvidenceGraph: !!evidenceResult,
          // Only render a citation marker for handles whose element is actually on the evidence graph,
          // so every dot is actionable (drops Q# whole-retrieval + any off-graph handle).
          graphCitation: evidenceResult?.citedText && evidenceResult?.handleMap
            ? {
                citedText: evidenceResult.citedText,
                handleMap: filterHandlesToGraph(evidenceResult.handleMap, evidenceResult.graphData),
              }
            : undefined,
          graphSnapshotId: msg.graphSnapshot?.id ?? null,
          graphSnapshotNodeCount: msg.graphSnapshot?.nodeIds.length ?? 0,
          artifacts: msg.artifacts
            .map(artifact => ({
              ...artifact,
              createdAt: new Date(artifact.createdAt),
            })),
          followUps: msg.followUps.map(followUp => ({
            ...followUp,
            createdAt: new Date(followUp.createdAt),
            updatedAt: new Date(followUp.updatedAt),
          })),
          userChoices: msg.userChoices.map(choice => ({
            ...choice,
            createdAt: new Date(choice.createdAt),
            updatedAt: new Date(choice.updatedAt),
          })),
          deepResearch: msg.deepResearch,
          deepResearchJobId: msg.deepResearchJobId,
          deepResearchStatus: msg.deepResearchStatus as DeepResearchStatus | null,
          asyncChatJobId: msg.asyncChatJobId,
          asyncChatStatus: msg.asyncChatStatus as AsyncChatStatus | null,
          progressMessages: msg.progressMessages,
          graphSearchResult: msg.graphSearchResult as GraphSearchResultData[] | undefined,
          feedback: msg.feedback,
          createdAt: new Date(msg.messagedAt),
        });
      }

      // Find the last non-error message for retry logic
      const lastMessage = [...msgs].reverse().find(m => m.asyncChatStatus !== AsyncChatStatus.ERROR);
      const hasProcessingMessage = msgs.some(m => m.asyncChatStatus === AsyncChatStatus.PROCESSING);
      
      // Only show retry if last message is from User AND there's no message currently processing
      if (lastMessage && lastMessage.role === MessageRole.User && !hasProcessingMessage) {
        if (regeneratingResponse) {
          entries.push({
            id: `retry-${lastMessage.id}`,
            chatId: chatId ?? '',
            type: EntryType.Skeleton,
            role: MessageRole.Assistant,
            createdAt: new Date(),
          });
        } else {
          entries.push({
            id: `retry-${lastMessage.id}`,
            chatId: chatId ?? '',
            type: EntryType.Retry,
            role: MessageRole.Assistant,
            createdAt: new Date(),
          });
        }
      }
    } else {
      if (systemSkeleton) {
        // Add skeleton if we're still loading prompt data
        entries.push(systemSkeleton);
      } else if (placeholder) {
        entries.push(placeholder);
      }
    }

    // Only add pending entries if the real data doesn't already contain them
    // This prevents duplicate entries during the brief moment between cache update and state clear
    const hasAsyncProcessingMessage = messagesQry.data?.messages.some(
      msg => msg.asyncChatStatus === AsyncChatStatus.PROCESSING
    );
    // Also check if the user's message already exists in the real data (for sync chat)
    const pendingMessageAlreadyInData = messagesQry.data?.messages.some(
      msg => msg.role === MessageRole.User && msg.content === pendingMessage
    );

    if (!!pendingMessage && !hasAsyncProcessingMessage && !pendingMessageAlreadyInData) {
      entries.push(
        {
          id: 'pending',
          chatId: chatId ?? '',
          type: EntryType.Message,
          role: MessageRole.User,
          content: pendingMessage,
          deepResearch: false,
          createdAt: new Date(),
        },
        {
          id: 'pending',
          chatId: chatId ?? '',
          type: EntryType.Skeleton,
          role: MessageRole.Assistant,
          createdAt: new Date(),
        }
      );
    }

    entries.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    return entries;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    chatId,
    systemMessage,
    promptQry.isPending,
    promptQry.isFetched,
    promptQry.data,
    messagesQry.data,
    pendingMessage,
    regeneratingResponse,
  ]);

  return entries;
}
