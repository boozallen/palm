import { Box, Stack, Table, Text } from '@mantine/core';

import useGetTemplates from '@/features/settings/api/templates/get-templates';
import Loading from '@/features/shared/components/Loading';
import ArtifactTemplatesRow from './ArtifactTemplatesRow';

export default function ArtifactTemplatesTable() {
  const {
    data: templatesData,
    isPending: templatesIsPending,
    error: templatesError,
  } = useGetTemplates();

  if (templatesIsPending) {
    return <Loading />;
  }

  if (templatesError) {
    return <Text>{templatesError.message}</Text>;
  }

  if (!templatesData || templatesData.templates.length === 0) {
    return (
      <Box bg='dark.8' p='md'>
        <Text c='gray.4'>No templates found.</Text>
      </Box>
    );
  }

  return (
    <Stack bg='dark.6' p='md' spacing='lg'>
      <Table data-testid='artifact-templates-table'>
        <thead>
          <tr>
            <th>Filename</th>
            <th>File Type</th>
            <th>Uploaded</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {templatesData.templates.map((template) => (
            <ArtifactTemplatesRow
              key={template.id}
              id={template.id}
              filename={template.filename}
              createdAt={template.createdAt}
            />
          ))}
        </tbody>
      </Table>
    </Stack>
  );
}
