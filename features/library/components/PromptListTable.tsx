import { Anchor, Group, Table } from '@mantine/core';
import { useRouter } from 'next/router';
import TagBadges from '@/components/elements/TagBadges';
import { Prompt } from '@/features/shared/types';
import PromptActions from './PromptActions';
import { generatePromptUrl } from '@/features/shared/utils';
import { KeyboardEvent } from 'react';

type PromptListTableProps = Readonly<{
  prompts: Prompt[];
}>;

export function PromptListTable({ prompts }: PromptListTableProps) {

  const router = useRouter();

  const handleAnchorOnClick = (prompt: Prompt) => {
    router.push(generatePromptUrl(prompt.title, prompt.id));
  };

  const handleAnchorKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>, prompt: Prompt) => {
    if (event.key === 'Enter') {
      router.push(generatePromptUrl(prompt.title, prompt.id));
    }
  };

  return (
    <Table striped variant='prompt_list_table'>
      <thead>
        <tr>
          <th>Prompt</th>
          <th>Prompt description</th>
          <th>Tag(s)</th>
        </tr>
      </thead>
      <tbody>
        {prompts?.map((prompt: Prompt) => (
          <tr key={prompt.id}>
            <td>
              <Anchor
                tabIndex={0}
                title={prompt.title}
                onClick={() => handleAnchorOnClick(prompt)}
                onKeyDown={(event: KeyboardEvent<HTMLAnchorElement>) => handleAnchorKeyDown(event, prompt)}
              >
                {prompt.title}
              </Anchor>
            </td>
            <td>{prompt.summary}</td>
            <td>
              <Group spacing='sm'>
                <TagBadges tags={prompt.tags} />
              </Group>
            </td>
            <td>
              <PromptActions id={prompt.id} title={prompt.title} creatorId={prompt.creatorId} />
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
