import { SimpleGrid, Stack, Group, Text, Title, Flex } from '@mantine/core';

import BookmarkIcon from '@/components/elements/BookmarkIcon';
import SaveCustomizedPromptButton from './buttons/SaveCustomizedPromptButton';
import TagBadges from '@/components/elements/TagBadges';
import { usePromptDetails } from '@/features/library/providers/PromptDetailsProvider';
import Breadcrumbs from '@/components/elements/Breadcrumbs';

const PromptDetailsHeader: React.FC = () => {

  const { prompt } = usePromptDetails();

  return (
    <SimpleGrid cols={1} p='xl'>
      <Flex justify='space-between' align='flex-start'>
        <Stack spacing='xs'>
          <Flex gap='lg' align='center'>
            <BookmarkIcon id={prompt.id} />
            <Title fz='xxl' color='gray.1'>
              {prompt.title}
            </Title>
          </Flex>
          <Group spacing='sm'>
            <TagBadges tags={prompt.tags} />
          </Group>
          <Text size='md' color='gray.6'>
            {prompt.summary}
          </Text>
          <Text size='sm' color='gray.6'>
            {prompt.description}
          </Text>
        </Stack>
        <SaveCustomizedPromptButton />
      </Flex>
      <Breadcrumbs links={[
        { title: 'Prompt Library', href: '/library' },
        { title: prompt.title, href: null },
      ]}/>
    </SimpleGrid>
  );
};

export default PromptDetailsHeader;
