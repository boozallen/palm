import { useRouter } from 'next/router';

import useGetChat from '@/features/chat/api/get-chat';
import ChatInterface from '@/features/chat/components/ChatInterface';
import CenteredLoader from '@/features/shared/components/CenteredLoader';

export default function Conversation() {
  const router = useRouter();
  const { chatId } = router.query as { chatId: string };

  const { data, isPending } = useGetChat(chatId);

  if (isPending) {
    return <CenteredLoader />;
  }

  if (!data) {
    return <></>;
  }

  const AGENT_PROVIDER_PREFIX = 'agent-provider::';
  const effectiveModelId = data.chat.agentProviderId
    ? `${AGENT_PROVIDER_PREFIX}${data.chat.agentProviderId}`
    : data.chat.modelId;

  return (
    <ChatInterface
      chatId={data.chat.id}
      promptId={data.chat.promptId}
      modelId={effectiveModelId}
    />
  );
}
