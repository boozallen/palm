import { ActionIcon, Box, Group, Stack, Title, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconCirclePlus } from '@tabler/icons-react';

import AddDocumentModal from './modals/AddDocumentModal';
import DocumentLibraryTable from './tables/DocumentLibraryTable';
import useGetHasOpenAiModel from '@/features/shared/api/get-has-openai-model';
import Loading from '@/features/shared/components/Loading';

export default function DocumentLibrary() {
  const {
    data: hasOpenAiModel,
    isPending: hasOpenAiModelIsLoading,
  } = useGetHasOpenAiModel();

  const [
    addDocumentModalOpened,
    { open: openAddDocumentModal, close: closeAddDocumentModal },
  ] = useDisclosure();

  if (hasOpenAiModelIsLoading) {
    return <Loading />;
  }

  return (
    <>
      <AddDocumentModal
        isModalOpen={addDocumentModalOpened}
        closeModalHandler={closeAddDocumentModal}
      />

      <Stack spacing='md' p='xl' bg='dark.6'>
        <Group spacing='sm'>
          <Title weight='bold' color='gray.6' order={2}>
            My Uploaded Documents
          </Title>
          <Tooltip
            label='This functionality requires access to an OpenAI model. Please reach out to your group lead or manager to get access.'
            disabled={hasOpenAiModel}
            withArrow
            // Explicitly set events to prevent tooltip from showing whenever disabled prop changes value
            events={{ 'hover': true, 'focus': true, 'touch': true }}
          >
            <Box>
              <ActionIcon
                variant='system_management'
                data-testid='add-document-button'
                onClick={openAddDocumentModal}
                aria-label='Upload documents'
                disabled={!hasOpenAiModel}
              >
                <IconCirclePlus />
              </ActionIcon>
            </Box>
          </Tooltip>
        </Group>
        <DocumentLibraryTable />
      </Stack>
    </>
  );
}
