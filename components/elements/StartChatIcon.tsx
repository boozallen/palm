import { ThemeIcon, UnstyledButton } from '@mantine/core';
import { useRouter } from 'next/router';
import { IconMessageShare } from '@tabler/icons-react';

type StartChatIconProps = Readonly<{
  id: string
}>;

export default function StartChatIcon({ id }: StartChatIconProps) {
  const router = useRouter();

  const handleStartChat = (e: React.MouseEvent) => {
    router.push(`/chat?promptid=${id}`);
    e.stopPropagation();
  };

  return (
    <UnstyledButton onClick={handleStartChat} aria-label='start chat' data-testid='StartChatIcon'>
      <ThemeIcon mt={2}>
        <IconMessageShare />
      </ThemeIcon>
    </UnstyledButton>
  );
}
