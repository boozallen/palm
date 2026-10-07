import { ThemeIcon, UnstyledButton, Tooltip } from '@mantine/core';
import { useRouter } from 'next/router';
import { IconMessageShare } from '@tabler/icons-react';

import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type StartChatIconProps = Readonly<{
  id: string
}>;

export default function StartChatIcon({ id }: StartChatIconProps) {
  const router = useRouter();
  const track = useTrackClientEvent();

  const handleStartChat = (e: React.MouseEvent) => {
    const url = `/chat?promptid=${id}`;
    track.navigate('Start chat with prompt', url);
    router.push(url);
    e.stopPropagation();
  };

  return (
    <Tooltip label='Start chat with prompt' position='bottom'>
      <UnstyledButton onClick={handleStartChat} aria-label='start chat' data-testid='StartChatIcon'>
        <ThemeIcon mt={2}>
          <IconMessageShare />
        </ThemeIcon>
      </UnstyledButton>
    </Tooltip>
  );
}
