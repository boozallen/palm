import { ThemeIcon, UnstyledButton } from '@mantine/core';
import { IconPencil } from '@tabler/icons-react';
import { useRouter } from 'next/router';

import { generatePromptUrl } from '@/features/shared/utils';

type EditPromptIconProps = Readonly<{
  id: string;
  title: string;
}>;

export default function EditPromptIcon({ id, title }: EditPromptIconProps) {
  const router = useRouter();

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    router.push(`${generatePromptUrl(title, id)}/edit`);
  };

  return (
    <UnstyledButton onClick={handleEdit} aria-label='edit prompt'>
      <ThemeIcon>
        <IconPencil />
      </ThemeIcon>
    </UnstyledButton>
  );
}
