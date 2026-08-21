import { Text, Skeleton, Box, Title, List } from '@mantine/core';
import { ReactNode } from 'react';

import { type SkeletonEntry } from '@/features/chat/types/entry';
import Entry from '@/features/chat/components/entries/Entry';
import { UserAvatar } from '@/features/chat/components/entries/elements/Avatars';
import { MessageRole } from '@/features/chat/types/message';
import { useChat } from '@/features/chat/providers/ChatProvider';

type SkeletonEntryProps = Readonly<{
  entry: SkeletonEntry;
  deepResearchEnabled: boolean;
}>;

export default function SkeletonEntry({ entry, deepResearchEnabled }: SkeletonEntryProps) {
  const { selectedArtifact, useGraph } = useChat();
  
  // Handle System role skeleton differently to match SystemEntry layout
  if (entry.role === MessageRole.System) {
    return (
      <List.Item>
        <Box
          bg='dark.5'
          my='md'
          mx={selectedArtifact ? 'md' : 'md'}
          style={{ borderRadius: '8px' }}
        >
          <Title
            c='gray.6'
            fz='sm'
            fw='bold'
            order={4}
            px='md'
            py='xs'
          >
            <span style={{ opacity: 0 }}>System Persona</span>
          </Title>
          <Box bg='dark.8' pt='lg' px='sm' pb='lg' style={{ borderBottomLeftRadius: '8px', borderBottomRightRadius: '8px' }}>
            <Text c='gray.6' fz='sm' p='sm'>
              <Skeleton height={12} radius='xl'/>
              <Skeleton height={12} mt={6} radius='xl'/>
              <Skeleton height={12} mt={6} width='80%' radius='xl'/>
            </Text>
          </Box>
        </Box>
      </List.Item>
    );
  }

  let avatar: ReactNode | null = null;
  let role: MessageRole = MessageRole.Assistant;

  if (entry.role === MessageRole.User) {
    avatar = <UserAvatar />;
    role = MessageRole.User;
  }

  return (
    <Entry id={entry.id} avatar={avatar} role={role} useGraph={useGraph}>
      {deepResearchEnabled ? (
        <>
          <Text size='lg' fw={600} c='blue.6' mb='xs'>
            Deep research in progress
          </Text>
          <Text size='sm' mb='md'>
            Searching the web, analyzing findings, and synthesizing results. This typically takes 2-10 minutes depending on the complexity of your question.
          </Text>
          <Skeleton height={8} radius='xl' />
          <Skeleton height={8} mt={6} radius='xl' />
          <Skeleton height={8} mt={6} width='70%' radius='xl' />
        </>
      ) : (
        <>
          <Skeleton height={8} radius='xl' />
          <Skeleton height={8} mt={6} radius='xl' />
          <Skeleton height={8} mt={6} width='70%' radius='xl' />
        </>
      )}
    </Entry>
  );
}
