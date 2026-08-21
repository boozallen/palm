import { useSearchParams } from 'next/navigation';

import ChatInterface from '@/features/chat/components/ChatInterface';

export default function Conversation() {
  const searchParams = useSearchParams();
  const promptId = searchParams.get('promptid');

  return (
    <ChatInterface promptId={promptId} />
  );
}
