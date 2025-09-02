import { Group } from '@mantine/core';
import BookmarkIcon from '@/components/elements/BookmarkIcon';
import DeletePromptIcon from '@/components/elements/DeletePromptIcon';
import EditPromptIcon from '@/components/elements/EditPromptIcon';
import StartChatIcon from '@/components/elements/StartChatIcon';
import { useSession } from 'next-auth/react';
import { UserRole } from '@/features/shared/types/user';

type PromptActionsProps = Readonly<{
  id: string;
  title: string;
  creatorId: string | null;
}>;

export default function PromptActions({ id, title, creatorId }: PromptActionsProps) {
  const user = useSession().data?.user;
  const authorizedUser = user?.role === UserRole.Admin || user?.id === creatorId;

  return (
    <Group align='center' p='md' spacing ='sm'>
      <BookmarkIcon id={id} />
      <StartChatIcon id={id} />
      {authorizedUser &&
        <>
          <EditPromptIcon id={id} title={title} />
          <DeletePromptIcon id={id} />
        </>
      }
    </Group>
  );
}
