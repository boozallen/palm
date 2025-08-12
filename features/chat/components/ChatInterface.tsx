import { Stack, Box, Group } from '@mantine/core';
import ChatContent from './ChatContent';
import ChatHeader from './ChatHeader';
import ChatFooter from './ChatFooter';
import ChatLayout from '@/components/layouts/ChatLayout/ChatLayout';
import { ChatProvider, useChat } from '@/features/chat/providers/ChatProvider';
import ArtifactContent from './ArtifactContent';

type ChatInterfaceProps = Readonly<{
  chatId?: string | null;
  promptId?: string | null;
  modelId?: string | null;
}>;

function ChatInterfaceContent() {
  const { selectedArtifact } = useChat();

  return (
    <Stack h='100%' spacing={0}>
      <ChatHeader />
      <Box pl={selectedArtifact ? 'lg' : '0'} style={{ flex: 1, minHeight: 0 }}>
        <Group align='stretch' spacing={0} h='100%' noWrap>
          <Stack
            spacing={0}
            style={{
              flex: selectedArtifact ? '0 0 50%' : '1',
              minWidth: 0,
            }}
          >
            <Box style={{ flex: 1, minHeight: 0 }}>
              <ChatContent />
            </Box>
            <ChatFooter />
          </Stack>

          {selectedArtifact && (
            <Stack
              style={{
                flex: '0 0 50%',
                minWidth: 0,
                height: '100%',
              }}
              px='lg'
              pb='lg'
              spacing={0}
            >
              <ArtifactContent artifact={selectedArtifact} />
            </Stack>
          )}
        </Group>
      </Box>
    </Stack>
  );
}

export default function ChatInterface({
  chatId,
  promptId,
  modelId,
}: ChatInterfaceProps) {
  return (
    <ChatLayout>
      <ChatProvider chatId={chatId} promptId={promptId} modelId={modelId}>
        <ChatInterfaceContent />
      </ChatProvider>
    </ChatLayout>
  );
}
