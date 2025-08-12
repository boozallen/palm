import { useRouter } from 'next/router';

import useGetChat from '@/features/chat/api/get-chat';
import ChatInterface from '@/features/chat/components/ChatInterface';
import Loading from '@/features/shared/components/Loading';

export default function Conversation() {
  const router = useRouter();
  const { chatId } = router.query as { chatId: string };

  const { data, isPending } = useGetChat(chatId);

  if (isPending) {
    return <Loading />;
  }

  if (!data) {
    return <></>;
  }

  return (
    <ChatInterface
      chatId={data.chat.id}
      promptId={data.chat.promptId}
      modelId={data.chat.modelId}
    />
  );
}
