import { useEffect, useMemo, useRef, useState } from 'react';
import { notifications } from '@mantine/notifications';
import RollupRow from '@/features/chat/components/agent-trace/RollupRow';

import Entry from '@/features/chat/components/entries/Entry';
import { MessageEntry } from '@/features/chat/types/entry';
import { MessageRole, AsyncChatStatus } from '@/features/chat/types/message';
import AssistantEntryActions from '@/features/chat/components/entries/actions/AssistantEntryActions';
import { useChat } from '@/features/chat/providers/ChatProvider';
import SelectedTextPopup from '@/features/chat/components/entries/actions/SelectedTextPopup';
import FollowUpQuestions from '@/features/chat/components/entries/elements/FollowUpQuestions';
import UserChoices from '@/features/chat/components/entries/elements/UserChoices';
import MessageContent, { type GraphCitationHandlers } from '@/features/chat/components/MessageContent';
import { useGetChatJobStatus } from '@/features/chat/api/get-chat-job-status';
import { trpc } from '@/libs';
import AgentTrace from '@/features/chat/components/agent-trace/AgentTrace';
import { buildAgentTraceFromData } from '@/features/chat/utils/buildAgentTrace';

type AssistantEntryProps = Readonly<{
  entry: MessageEntry;
  isLatestResponse: boolean;
  followUpReferencedInNextUserEntry?: boolean;
}>;

export default function AssistantEntry({
  entry,
  isLatestResponse,
  followUpReferencedInNextUserEntry,
}: AssistantEntryProps) {
  const { chatId, useGraph, requestGraphCitationPin } = useChat();
  const containerRef = useRef<HTMLDivElement>(null);
  const hasInvalidatedRef = useRef(false);
  const cachedProgressMessagesRef = useRef<string[]>([]);
  const [streamingContent, setStreamingContent] = useState('');
  const utils = trpc.useUtils();

  // Citation → graph remote control. Right-clicking an inline citation pins the cited node/edge on the
  // canvas, identically to right-clicking that element on the canvas (the canvas owns the pin toggle;
  // here we just forward the gesture). Defined only for graph-evidence answers (the evidence entry
  // carries citedText + handleMap); else plain markdown.
  const graphCitations: GraphCitationHandlers | undefined = useMemo(() => {
    const gc = entry.graphCitation;
    if (!gc?.citedText || !gc?.handleMap) {
      return undefined;
    }
    return {
      handleMap: gc.handleMap,
      onPin: (target) => {
        if (target) {
          // Carry this answer's message id so the canvas can jump to (or re-add onto) the right turn's
          // evidence graph when the cited element isn't currently shown.
          requestGraphCitationPin(target, entry.id);
        } else {
          // A [[Q#]] (whole-retrieval) citation has no single node/edge to pin yet.
          notifications.show({
            message: 'That citation refers to a whole result set, not a single node.',
            color: 'gray',
            autoClose: 2500,
          });
        }
      },
    };
  }, [entry.graphCitation, entry.id, requestGraphCitationPin]);

  // Check if this is an async chat completion that needs polling
  const isAsyncProcessing = entry.asyncChatStatus === AsyncChatStatus.PROCESSING;

  // Poll for async chat job status if needed (only if we have a jobId and still processing)
  const { data: chatJobStatus } = useGetChatJobStatus(
    isAsyncProcessing ? entry.asyncChatJobId ?? undefined : undefined,
    chatId || ''
  );

  // Refresh messages when async chat completes or fails (only once per job)
  useEffect(() => {
    if ((chatJobStatus?.status === 'completed' || chatJobStatus?.status === 'error' || chatJobStatus?.status === 'cancelled') && chatId && !hasInvalidatedRef.current) {
      hasInvalidatedRef.current = true;
      utils.chat.getMessages.invalidate({ chatId });
    }
  }, [chatJobStatus?.status, chatId, utils.chat.getMessages]);

  // Open an EventSource to stream token deltas in real-time while the job runs
  useEffect(() => {
    if (!isAsyncProcessing || !entry.asyncChatJobId) { return; }

    const jobId = entry.asyncChatJobId;
    setStreamingContent('');
    let accumulated = '';

    const es = new EventSource(`/api/chat/stream/${jobId}`);

    es.addEventListener('delta', (event) => {
      const { text } = JSON.parse((event as MessageEvent).data as string) as { text: string };
      accumulated += text;
      // Strip FOLLOWUP markers from the live view — complete blocks and any partial
      // tag still being generated at the tail. The worker processes the full raw content.
      const display = accumulated
        .replace(/<FOLLOWUP>.*?<\/FOLLOWUP>/gs, '')
        .replace(/<FOLLOWUP>[^]*$/, '')
        .trimEnd();
      setStreamingContent(display);
    });

    const closeAndInvalidate = (): void => {
      es.close();
      if (chatId) {
        void utils.chat.getMessages.invalidate({ chatId });
      }
    };

    es.addEventListener('done', closeAndInvalidate);
    es.onerror = (): void => {
      if (es.readyState === EventSource.CLOSED) {
        closeAndInvalidate();
      }
    };

    return () => { es.close(); };
  }, [isAsyncProcessing, entry.asyncChatJobId, chatId, utils.chat.getMessages]);

  // Keep progress messages alive after polling stops
  useEffect(() => {
    if (chatJobStatus?.messages && chatJobStatus.messages.length > 0) {
      cachedProgressMessagesRef.current = chatJobStatus.messages;
    }
  }, [chatJobStatus?.messages]);

  // Build timeline from available data
  const timeline = useMemo(() => {
    const isAgenticChatMessage = !!entry.asyncChatJobId;
    if (!isAgenticChatMessage) {
      return null;
    }

    const progressMessages = chatJobStatus?.messages?.length
      ? chatJobStatus.messages
      : cachedProgressMessagesRef.current.length
        ? cachedProgressMessagesRef.current
        : entry.progressMessages || [];

    return buildAgentTraceFromData({
      progressMessages,
      graphSearchResults: entry.graphSearchResult || [],
      citations: entry.citations || [],
      artifactCount: entry.artifacts?.length || 0,
      artifacts: entry.artifacts || [],
      isProcessing: isAsyncProcessing,
    });
  }, [entry.asyncChatJobId, entry.graphSearchResult, entry.citations, entry.artifacts, chatJobStatus?.messages, entry.progressMessages, isAsyncProcessing]);

  return (
    <div style={{ position: 'relative' }}>
      <Entry
        id={entry.id}
        avatar={null}
        role={MessageRole.Assistant}
        deepResearch={entry.deepResearch}
        citations={entry.citations}
        hasEvidenceGraph={entry.hasEvidenceGraph}
        useGraph={useGraph}
        artifacts={isAsyncProcessing ? [] : entry.artifacts}
        actions={
          !isAsyncProcessing ? (
            <AssistantEntryActions
              messageId={entry.id}
              messageContent={entry.content}
              feedback={entry.feedback}
            />
          ) : undefined
        }
      >
        <div ref={containerRef}>
          {isAsyncProcessing && !timeline && (
            <RollupRow
              toolCallCount={0}
              completedToolCallCount={0}
              isProcessing={true}
            />
          )}
          {timeline && <AgentTrace steps={timeline} isProcessing={isAsyncProcessing} />}

          {isAsyncProcessing && !!streamingContent && (
            <MessageContent
              content={streamingContent}
              graphCitations={undefined}
            />
          )}

          {!isAsyncProcessing && (
            <MessageContent
              content={entry.graphCitation?.citedText ?? entry.content}
              graphCitations={graphCitations}
            />
          )}
        </div>
      </Entry>

      {!isAsyncProcessing && (
        <UserChoices userChoices={entry.userChoices} />
      )}

      {!isAsyncProcessing && (
        <FollowUpQuestions
          followUpQuestions={followUpReferencedInNextUserEntry || isLatestResponse ? entry.followUps : []}
        />
      )}

      {!isAsyncProcessing && (
        <SelectedTextPopup
          containerRef={containerRef}
          messageId={entry.id}
        />
      )}
    </div>
  );
}
