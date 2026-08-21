import { Button, Menu, Tooltip } from '@mantine/core';
import { IconChevronDown, IconPlus, IconSparkles } from '@tabler/icons-react';
import { useRouter } from 'next/router';

export default function CreatePromptMenu() {
  const router = useRouter();

  const handleClickGeneratePrompt = () => {
    router.push('/prompt-generator');
  };

  const handleClickAddPrompt = () => {
    router.push('/library/add');
  };

  return (
    <Menu
      transitionProps={{ transition: 'pop-top-right' }}
      position='top-end'
    >
      <Menu.Target>
        <Button
          rightIcon={
            <IconChevronDown stroke={1} />
          }
        >
          Create Prompt
        </Button>
      </Menu.Target>
      <Menu.Dropdown>
        <Tooltip label='Use the power of AI to generate a new prompt' openDelay={500}>
          <Menu.Item
            color='gray.6'
            onClick={handleClickGeneratePrompt}
            icon={
              <IconSparkles stroke={1.5} />
            }
            p='sm'
          >
            Generate Prompt
          </Menu.Item>
        </Tooltip>
        <Tooltip label='Manually create a new prompt from scratch' openDelay={500}>
          <Menu.Item
            color='gray.6'
            onClick={handleClickAddPrompt}
            icon={
              <IconPlus stroke={1.5} />
            }
            p='sm'
          >
            Add New Prompt
          </Menu.Item>
        </Tooltip>
      </Menu.Dropdown>
    </Menu>
  );
}
