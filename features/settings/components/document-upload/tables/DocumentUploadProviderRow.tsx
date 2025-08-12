import { ActionIcon, Group, ThemeIcon, Text, Tooltip } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconTrash, IconCheck, IconX, IconInfoCircle } from '@tabler/icons-react';

import { documentUploadProviderLabels, SanitizedDocumentUploadProvider } from '@/features/shared/types/document-upload-provider';
import DeleteDocumentUploadProviderModal from '@/features/settings/components/document-upload/modals/DeleteDocumentUploadProviderModal';
import useGetDocumentUploadRequirements from '@/features/settings/api/document-upload/get-document-upload-requirements';
import { RequirementNames } from '@/features/settings/types/system-requirements';
import Loading from '@/features/shared/components/Loading';

type DocumentUploadProviderRowProps = {
  provider: SanitizedDocumentUploadProvider;
};

export default function DocumentUploadProviderRow({ provider }: DocumentUploadProviderRowProps) {
  const { data: requirementsData, isPending: isLoadingRequirements } =
    useGetDocumentUploadRequirements();

  const [
    deleteProviderModalIsOpened,
    { open: openDeleteProviderModal, close: closeDeleteProviderModal },
  ] = useDisclosure();

  let requirementsContent;

  if (isLoadingRequirements) {
    requirementsContent = (
      <Loading />
    );
  } else if (requirementsData?.requirements && requirementsData.requirements.length > 0) {
    const openAiRequirement = requirementsData.requirements.find(req => req.name === RequirementNames.OPENAI_MODEL);
    if (openAiRequirement) {
      const content = (
        <Group spacing='xs' noWrap>
          <ThemeIcon
            size='sm'
            variant='light'
            color={openAiRequirement.available ? 'green' : 'red'}
          >
            {openAiRequirement.available ? (
              <IconCheck color='green' stroke={3} />
            ) : (
              <IconX color='red' />
            )}
          </ThemeIcon>
          <Text size='sm'>{openAiRequirement.name}</Text>
        </Group>
      );

      if (openAiRequirement.available) {
        requirementsContent = content;
      } else {
        requirementsContent = (
          <Group spacing='xs' noWrap>
            {content}
            <Tooltip label='An OpenAI model is required for this provider'>
              <ThemeIcon size='xs'>
                <IconInfoCircle />
              </ThemeIcon>
            </Tooltip>
          </Group>
        );
      }
    }
  }

  return (
    <>
      <DeleteDocumentUploadProviderModal
        opened={deleteProviderModalIsOpened}
        closeModalHandler={closeDeleteProviderModal}
        providerId={provider.id}
      />

      <tr>
        <td>{provider.label}</td>
        <td>{documentUploadProviderLabels[provider.providerType]}</td>
        <td>{provider.sourceUri}</td>
        <td>{requirementsContent}</td>
        <td>
          <ActionIcon
            aria-label={`Delete provider ${provider.label}`}
            onClick={openDeleteProviderModal}
          >
            <IconTrash />
          </ActionIcon>
        </td>
      </tr>
    </>
  );
}
