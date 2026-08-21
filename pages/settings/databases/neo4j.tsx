import { SimpleGrid, Title, Text, Stack, Box } from '@mantine/core';

import Breadcrumbs from '@/components/elements/Breadcrumbs';
import GraphVisualization from '@/features/settings/components/graph-databases/components/GraphVisualization';

export default function Neo4jPage() {
  const links = [
    { title: 'Settings', href: '/settings' },
    { title: 'Databases', href: '/settings?tab=databases' },
    { title: 'Neo4j', href: null },
  ];

  return (
    <>
      <SimpleGrid cols={1} p='md' pb='md' bg='dark.6'>
        <Stack spacing='xxs'>
          <Title fz='xxl' order={1} align='left' color='gray.1'>
            Neo4j Graph Database
          </Title>
          <Text fz='md' c='gray.6'>
            Manage and visualize your Neo4j graph database
          </Text>
        </Stack>
        <Breadcrumbs links={links} />
      </SimpleGrid>

      <Box p='md'>
        <GraphVisualization />
      </Box>
    </>
  );
}
