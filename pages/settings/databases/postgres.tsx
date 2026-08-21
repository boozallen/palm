import { SimpleGrid, Title, Text, Stack, Box } from '@mantine/core';

import Breadcrumbs from '@/components/elements/Breadcrumbs';
import PostgresQueryInterface from '@/features/settings/components/databases/components/PostgresQueryInterface';

export default function PostgresPage() {
  const links = [
    { title: 'Settings', href: '/settings' },
    { title: 'Databases', href: '/settings?tab=databases' },
    { title: 'PostgreSQL', href: null },
  ];

  return (
    <>
      <SimpleGrid cols={1} p='md' pb='md' bg='dark.6'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            PostgreSQL Database
          </Title>
          <Text fz='md' c='gray.6'>
            Execute read-only queries on the database
          </Text>
        </Stack>
        <Breadcrumbs links={links} />
      </SimpleGrid>

      <Box p='md'>
        <PostgresQueryInterface />
      </Box>
    </>
  );
}
