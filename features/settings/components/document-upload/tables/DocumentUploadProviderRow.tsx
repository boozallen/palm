import {
  ActionIcon,
  Group,
  ThemeIcon,
  Text,
  Tooltip,
  Stack,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconTrash,
  IconCheck,
  IconX,
  IconInfoCircle,
} from '@tabler/icons-react';

import {
  documentUploadProviderLabels,
  SanitizedDocumentUploadProvider,
} from '@/features/shared/types/document-upload-provider';
import DeleteDocumentUploadProviderModal from '@/features/settings/components/document-upload/modals/DeleteDocumentUploadProviderModal';
import useGetDocumentUploadRequirements from '@/features/shared/api/document-upload/get-document-upload-requirements';
import Loading from '@/features/shared/components/Loading';
import { RequirementNames } from '@/features/settings/types/system-requirements';

type DocumentUploadProviderRowProps = {
  provider: SanitizedDocumentUploadProvider;
};

export default function DocumentUploadProviderRow({
  provider,
}: DocumentUploadProviderRowProps) {
  const [
    deleteProviderModalIsOpened,
    { open: openDeleteProviderModal, close: closeDeleteProviderModal },
  ] = useDisclosure();

  const { data: requirementsData, isPending: requirementsLoading } =
    useGetDocumentUploadRequirements();

  let requirementsContent;

  if (requirementsLoading) {
    requirementsContent = <Loading />;
  } else if (
    requirementsData?.requirements &&
    requirementsData.requirements.length > 0
  ) {
    requirementsContent = (
      <Stack spacing='xs' w='100%'>
        {requirementsData.requirements.map((req) => {
          const content = (
            <Group key={req.name} spacing='xs' noWrap>
              <ThemeIcon
                size='sm'
                variant='light'
                color={req.available ? 'green' : 'red'}
              >
                {req.available ? (
                  <IconCheck color='green' stroke={3} />
                ) : (
                  <IconX color='red' />
                )}
              </ThemeIcon>
              <Text size='sm'>{req.name}</Text>
            </Group>
          );

          if (
            !req.available &&
            req.name === RequirementNames.BEDROCK_AI_PROVIDER
          ) {
            return (
              <Group key={req.name} spacing='xs' noWrap>
                {content}
                <Tooltip
                  label={'This feature requires an AWS Bedrock AI provider and model to be set'}
                >
                  <ThemeIcon size='xs'>
                    <IconInfoCircle />
                  </ThemeIcon>
                </Tooltip>
              </Group>
            );
          }

          return content;
        })}
      </Stack>
    );
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
