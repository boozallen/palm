import { type SkeletonEntry } from '@/features/chat/types/entry';
import Entry from '@/features/chat/components/entries/Entry';
import { UserAvatar } from '@/features/chat/components/entries/elements/Avatars';
import { ReactNode } from 'react';
import { Skeleton } from '@mantine/core';
import { MessageRole } from '@/features/chat/types/message';

type SkeletonEntryProps = Readonly<{
  entry: SkeletonEntry;
}>;

export default function SkeletonEntry({ entry }: SkeletonEntryProps) {
  let avatar: ReactNode | null = null;
  let role: MessageRole = MessageRole.Assistant;

  if (entry.role === MessageRole.User) {
    avatar = <UserAvatar />;
    role = MessageRole.User;
  }

  return (
    <Entry id={entry.id} avatar={avatar} role={role}>
      <Skeleton height={8} radius='xl'/>
      <Skeleton height={8} mt={6} radius='xl'/>
      <Skeleton height={8} mt={6} width='70%' radius='xl'/>
    </Entry>
  );
}
