import { ThemeIcon, UnstyledButton, Tooltip } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { generatePromptUrl } from '@/features/shared/utils';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type EditPromptIconProps = Readonly<{
  id: string;
  title: string;
}>;

export default function EditPromptIcon({ id, title }: EditPromptIconProps) {
  const router = useRouter();
  const track = useTrackClientEvent();

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${generatePromptUrl(title, id)}/edit`;
    track.navigate(`Edit prompt: ${title}`, url);
    router.push(url);
  };

  return (
    <Tooltip label='Edit prompt' position='bottom'>
      <UnstyledButton onClick={handleEdit} aria-label='edit prompt'>
        <ThemeIcon>
          <IconPencil />
        </ThemeIcon>
      </UnstyledButton>
    </Tooltip>
  );
}
