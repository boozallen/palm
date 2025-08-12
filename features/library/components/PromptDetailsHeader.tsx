import { Flex, Group, Text, Title } from '@mantine/core';

import BookmarkIcon from '@/components/elements/BookmarkIcon';
import SaveCustomizedPromptButton from './buttons/SaveCustomizedPromptButton';
import TagBadges from '@/components/elements/TagBadges';
import { usePromptDetails } from '@/features/library/providers/PromptDetailsProvider';

const PromptDetailsHeader: React.FC = () => {

  const { prompt } = usePromptDetails();

  return (
    <>
      <Flex justify='space-between' p='xl' pb='xs'>
        <Flex gap='lg' align='center'>
          <BookmarkIcon id={prompt.id} />
          <Flex gap='xl' align='center' direction='row' wrap='wrap'>
            <Title fz='xxl' color='gray.1'>
              {prompt.title}
            </Title>
            <Group spacing='sm'>
              <TagBadges tags={prompt.tags} />
            </Group>
          </Flex>
        </Flex>
        <Flex justify='flex-end'>
          <SaveCustomizedPromptButton />
        </Flex>
      </Flex>
      <Text size='md' color='gray.6' px='xl'>
        {prompt.summary}
      </Text>
      <Text size='sm' color='gray.6' px='xl' pt='sm' pb='md'>
        {prompt.description}
      </Text>
    </>

  );
};

export default PromptDetailsHeader;
