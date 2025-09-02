import { useState } from 'react';
import {
  Box,
  Paper,
  ScrollArea,
  Title,
  Text,
  Modal,
  Anchor,
} from '@mantine/core';

import Markdown from '@/components/content/Markdown';
import { Policy } from '@/features/ai-agents/types/certa/webPolicyCompliance';

type PolicyContentProps = Readonly<{
  policy: Policy;
}>;

export default function PolicyContent({ policy }: PolicyContentProps) {
  const [opened, setOpened] = useState(false);
  const handleOpenModal = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    setOpened(true);
  };

  return (
    <Box>
      <Modal
        size='xl'
        opened={opened}
        onClose={() => setOpened(false)}
        title='Policy Content'
        scrollAreaComponent={ScrollArea.Autosize}
      >
        <Paper
          p='md'
          withBorder
          bg='dark.8'
          tabIndex={0}
          aria-label='Policy content'
        >
          <Markdown value={policy.content} />
        </Paper>
      </Modal>
      <Title order={3} color='gray.6' fz='xl' fw='bolder' mb='sm'>
        Policy Requirements
      </Title>
      <Text mb='sm'>
        {'Click '}
        <Anchor onClick={handleOpenModal} component='button'>
          {'here'}
        </Anchor>
        {' to view full policy.'}
      </Text>
      <ScrollArea h={350}>
        <Paper
          p='md'
          withBorder
          bg='dark.7'
          tabIndex={0}
          aria-label='Policy content'
        >
          <Markdown value={policy.requirements} />
        </Paper>
      </ScrollArea>
    </Box>
  );
}
