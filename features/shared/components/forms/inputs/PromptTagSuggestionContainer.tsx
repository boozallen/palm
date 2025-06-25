import TagBadges from '@/components/elements/TagBadges';
import { Button, Group, Stack, Text, Grid } from '@mantine/core';

type PromptTagSuggestionContainerProps = Readonly<{
  tags: string[],
  onAccept: (tags: string[]) => void,
  onClose: () => void,
}>

export default function PromptTagSuggestionContainer({ tags, onAccept, onClose }: PromptTagSuggestionContainerProps) {

  const hasTags = !!tags.length;

  const containerMessage = hasTags
    ? 'Based on the contents of your prompt, we recommend the following tags. Choosing \'Accept\' will replace the current tags in the input.'
    : 'No tags suggested.';

  const handleAccept = () => {
    onAccept(tags);
    onClose();
  };

  return (
    <Stack w='50%' p='sm' bg='dark.5' data-testid='prompt-tag-suggestion-container'>
      <Grid align='center'>
        <Grid.Col>
          <Text fz='sm' c='gray.6' p='xs'>
            {containerMessage}
          </Text>
        </Grid.Col>
      </Grid>
      {hasTags &&
        <Group pl='xs' spacing='sm'>
          <TagBadges tags={tags} />
        </Group>
      }
      <Group pl='xs' align='start'>
        {hasTags &&
          <Button
            variant='filled'
            size='xs'
            onClick={handleAccept}
          >
            Accept
          </Button>
        }
        <Button
          variant='outline'
          size='xs'
          onClick={onClose}
        >
          {hasTags ? 'Ignore' : 'Close'}
        </Button>
      </Group>
    </Stack>
  );
}
