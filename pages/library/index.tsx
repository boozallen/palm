import {
  Badge,
  Button,
  Group,
  SimpleGrid,
  Text,
  Title,
  ThemeIcon,
  Stack,
} from '@mantine/core';
import { useState, useEffect } from 'react';
import {
  IconFilter,
} from '@tabler/icons-react';
import { useDebouncedValue } from '@mantine/hooks';

import { useGetPrompts } from '@/features/library/api/get-prompts';
import CreatePromptMenu from '@/features/library/components/menus/CreatePromptMenu';
import PromptTabFilterContainer from '@/features/library/components/PromptTabFilterContainer';
import SearchBar from '@/features/shared/components/SearchBar';
import TagMultiselect from '@/features/library/components/TagMultiselect';
import PromptViewToggle from '@/features/library/components/PromptViewToggle';
import PromptsContainer from '@/features/library/components/PromptsContainer';
import CenteredLoader from '@/features/shared/components/CenteredLoader';
import { UiPreference } from '@/types/ui-preferences';

export default function Home() {
  // Manage 'Table' and 'Card' views with localStorage
  const [isTableView, setIsTableView] = useState(false);

  useEffect(() => {
    const savedView = localStorage.getItem(UiPreference.PROMPT_LIBRARY_VIEW);
    if (savedView === 'table') {
      setIsTableView(true);
    }
  }, []);

  const togglePromptsView = (flag: boolean) => {
    setIsTableView(flag);
    localStorage.setItem(UiPreference.PROMPT_LIBRARY_VIEW, flag ? 'table' : 'card');
  };

  // Prompt tab filter view
  const [activeTab, setActiveTab] = useState('all');
  const handleTabChange = (value: string) => {
    setActiveTab(value);
  };

  // Prompt text search
  const [searchFocused, setSearchFocused] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery] = useDebouncedValue(searchQuery, 500);

  // Prompt filter by tag(s)
  const [displayFilterByTags, setDisplayFilterByTags] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const [debouncedTagFilters] = useDebouncedValue(filteredTags, 500);

  // Get prompts
  const { data, isPending } = useGetPrompts({
    tabFilter: activeTab,
    search: debouncedSearchQuery,
    tags: debouncedTagFilters,
  });

  const prompts = data?.prompts ?? [];
  const stats = data?.stats ?? {};

  if (isPending) {
    return <CenteredLoader />;
  }

  if (!data) {
    return <Text>Failed to load prompts</Text>;
  }

  return (
    <>
      <SimpleGrid cols={2} p='md' pb='0' bg='dark.6'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            Prompt Library
          </Title>
          <Text fz='md' c='gray.6'>
            Curated prompts designed to enhance productivity and streamline AI-powered workflows.
          </Text>
        </Stack>

        <Group position='right'>
          <CreatePromptMenu />
        </Group>
        <PromptTabFilterContainer
          defaultValue={activeTab}
          onTabChange={handleTabChange}
        />
      </SimpleGrid>

      <SimpleGrid cols={2} p='md' pb='0'>
        <Group position='left'>
          {/* Search input */}
          <SearchBar
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchFocused={searchFocused}
            setSearchFocused={setSearchFocused}
            placeholder='Search a prompt'
          />
          {/* Filter by tags input toggle button */}
          <Button
            variant='default'
            bg='dark.4'
            leftIcon={
              <ThemeIcon style={{ transform: 'scaleX(-1)' }}>
                <IconFilter stroke={1} />
              </ThemeIcon>
            }
            rightIcon={
              filteredTags.length > 0 ? (
                <Badge variant='filled'>{filteredTags.length}</Badge>
              ) : null
            }
            onClick={() => {
              setDisplayFilterByTags(!displayFilterByTags);
            }}
          >
            Filter
          </Button>
        </Group>

        <Group position='right'>
          {/* Search results messaging count */}
          <Text align='right' c='gray.6' fz='md'>
            {debouncedSearchQuery.length === 0
              ? `${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)
              } prompts: `
              : `Results for "${debouncedSearchQuery}" : `}{' '}
            {prompts?.length} prompt{prompts?.length === 1 ? '' : 's'}
          </Text>

          {/* Toggle table/card views */}
          <PromptViewToggle isTableView={isTableView} togglePromptsView={togglePromptsView} />
        </Group>
      </SimpleGrid>

      {/* Filter by tags input row */}
      {displayFilterByTags && (
        <TagMultiselect
          filteredTags={filteredTags}
          setFilteredTags={setFilteredTags}
        />
      )}

      <PromptsContainer prompts={prompts} isTableView={isTableView} stats={stats} />
    </>
  );
}
