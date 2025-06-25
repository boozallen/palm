import { Box, Button } from '@mantine/core';
import { IconMessageCircle2 } from '@tabler/icons-react';
import { useRouter } from 'next/router';

function ChatWidget() {

  const router = useRouter();
  
  const handleNewConversation = () => {
    router.push('/chat');
  };

  return (
    <Box>
      <Button
        leftIcon={<IconMessageCircle2 />}
        fullWidth
        mb='sm'
        onClick={handleNewConversation}
      >
        New Conversation
      </Button>
    </Box>
  );
}

export default ChatWidget;
