import { Tabs } from '@mantine/core';

type PromptTabFilterContainerProps = {
  defaultValue: string;
  onTabChange: (value: string) => void;
};

export default function PromptTabFilterContainer({ defaultValue, onTabChange }: PromptTabFilterContainerProps) {
  return (
    <Tabs w='max-content' pt='md' defaultValue={defaultValue} onTabChange={onTabChange}>
      <Tabs.List>
        <Tabs.Tab value='all' pl='0'>
          All Prompts
        </Tabs.Tab>
        <Tabs.Tab value='owned'>
          Owned Prompts
        </Tabs.Tab>
        <Tabs.Tab value='bookmarked'>
          Bookmarked Prompts
        </Tabs.Tab>
      </Tabs.List>
    </Tabs>
  );
}
