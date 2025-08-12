import {
  Group,
  Title,
  Badge,
  ThemeIcon,
  Text,
  Box,
  Divider,
} from '@mantine/core';
import { IconChartBar, IconUsers, IconBrain } from '@tabler/icons-react';

type CategoryStats = Record<string, number>;

type SearchResultsProps = Readonly<{
  totalResults: number;
  totalInstitutions: number;
  categories: CategoryStats;
}>;

export default function SearchResults({
  totalResults,
  totalInstitutions,
  categories,
 }: SearchResultsProps) {
  return (
    <>
      <Group position='apart' mb='md'>
        <Title order={2} fw='bolder'>
          Search Results
        </Title>
        <Badge size='lg' variant='filled'>
          {totalResults} paper{totalResults !== 1 && 's'} found
        </Badge>
      </Group>

      <Group spacing='xl'>
        <Box>
          <Group spacing='xs' mb={4}>
            <ThemeIcon size='sm' radius='xl' variant='light' c='dimmed'>
              <IconChartBar size={14} />
            </ThemeIcon>
            <Text size='xs' color='dimmed'>
              Papers
            </Text>
          </Group>
          <Text size='xl' weight={500} ml='xs'>
            {totalResults}
          </Text>
        </Box>

        <Box>
          <Group spacing='xs' mb={4}>
            <ThemeIcon size='sm' radius='xl' variant='light' c='dimmed'>
              <IconUsers size={14} />
            </ThemeIcon>
            <Text size='xs' color='dimmed'>
              Institutions
            </Text>
          </Group>
          <Text size='xl' weight={500} ml='xxs'>
            {totalInstitutions}
          </Text>
        </Box>

        <Box>
          <Group spacing='xs' mb={4}>
            <ThemeIcon size='sm' radius='xl' variant='light' c='dimmed'>
              <IconBrain size={14} />
            </ThemeIcon>
            <Text size='xs' color='dimmed'>
              Categories
            </Text>
          </Group>
          <Text size='xl' weight={500} ml='xs'>
            {Object.keys(categories || {}).length}
          </Text>
        </Box>
      </Group>

      {!!totalResults && (
        <>
          <Divider my='md' />
          <Title order={2} fw='bolder'>
            Research Categories
          </Title>
          <Group spacing='sm' mt='md'>
            {
              Object.entries(categories)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <Badge key={category} size='lg' variant='filled' color='blue'>
                    {category}: {count}
                  </Badge>
                ))
            }
          </Group>
          <Divider my='md' />
        </>
      )}
    </>
  );
}
