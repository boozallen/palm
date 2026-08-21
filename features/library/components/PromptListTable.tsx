import { Anchor, Group, Table } from '@mantine/core';
import { useRouter } from 'next/router';
import TagBadges from '@/components/elements/TagBadges';
import { Prompt, PromptStatsMap } from '@/features/shared/types';
import PromptActions from './PromptActions';
import PromptStatsBadges from './PromptStatsBadges';
import { generatePromptUrl } from '@/features/shared/utils';
import { KeyboardEvent } from 'react';
import { useTrackClientEvent } from '@/features/shared/hooks/useTrackClientEvent';

type PromptListTableProps = Readonly<{
  prompts: Prompt[];
  stats: PromptStatsMap;
}>;

export function PromptListTable({ prompts, stats }: PromptListTableProps) {

  const router = useRouter();
  const track = useTrackClientEvent();

  const navigateToPrompt = (prompt: Prompt) => {
    const url = generatePromptUrl(prompt.title, prompt.id);
    track.navigate(prompt.title, url);
    router.push(url);
  };

  const handleAnchorOnClick = (prompt: Prompt) => {
    navigateToPrompt(prompt);
  };

  const handleAnchorKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>, prompt: Prompt) => {
    if (event.key === 'Enter') {
      navigateToPrompt(prompt);
    }
  };

  return (
    <Table striped variant='prompt_list_table'>
      <thead>
        <tr>
          <th>Prompt</th>
          <th>Prompt description</th>
          <th>Tag(s)</th>
          <th>Stats</th>
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
              {stats[prompt.id] && (
                <PromptStatsBadges stats={stats[prompt.id]} />
              )}
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
