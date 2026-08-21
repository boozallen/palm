import { ActionIcon, Badge, Group, Button, Tooltip, ThemeIcon } from '@mantine/core';
import { IconPencil, IconTrash, IconActivity } from '@tabler/icons-react';
import DeleteAiProviderModelModal from '@/features/settings/components/ai-providers/modals/DeleteAiProviderModelModal';
import { useDisclosure } from '@mantine/hooks';
import { Dispatch, SetStateAction, useState } from 'react';
import EditModelForm from '@/features/settings/components/ai-providers/forms/EditModelForm';
import useTestModel from '@/features/settings/utils/useTestModel';

type ModelRowProps = Readonly<{
  id: string;
  name: string;
  externalId: string;
  costPerMillionInputTokens: number;
  costPerMillionOutputTokens: number;
  embeddingsOnly?: boolean;
  modelBeingTested: string | null;
  setModelBeingTested: Dispatch<SetStateAction<string | null>>;
}>;

export default function ModelRow({
  modelBeingTested,
  setModelBeingTested,
  ...model
}: ModelRowProps) {

  const [
    deleteAiProviderModelModalOpened,
    {
      open: openDeleteAiProviderModelModal,
      close: closeDeleteAiProviderModelModal,
    },
  ] = useDisclosure(false);

  const [editModel, setEditModel] = useState<boolean>(false);

  const handleEditModel = () => {
    setEditModel(true);
  };

  const testModelStatus = useTestModel();

  const isTestingThisModel = modelBeingTested === model.id;

  const handleTestModelButtonClick = () => {
    setModelBeingTested(model.id);
    testModelStatus(model.id, (isPending) => {
      if (!isPending) {
        setModelBeingTested(null);
      }
    });
  };

  return (
    <>
      <DeleteAiProviderModelModal
        modalOpened={deleteAiProviderModelModalOpened}
        closeModalHandler={closeDeleteAiProviderModelModal}
        modelId={model.id}
      />

      <tr className='provider-model-row' data-testid={`${model.id}-model-row`}>
        {editModel ? (
          <td colSpan={7}>
            <EditModelForm
              id={model.id}
              name={model.name}
              externalId={model.externalId}
              costPerMillionInputTokens={model.costPerMillionInputTokens}
              costPerMillionOutputTokens={model.costPerMillionOutputTokens}
              embeddingsOnly={model.embeddingsOnly}
              setEditModel={setEditModel}
            />
          </td>
        ) : (
          <>
            <td colSpan={1}></td>
            <td>{model.name}</td>
            <td>{model.externalId}</td>
            <td>${model.costPerMillionInputTokens.toFixed(2)}</td>
            <td>${model.costPerMillionOutputTokens.toFixed(2)}</td>
            {/* The designation is chosen when the model is added, so this column
                reports it rather than editing it. */}
            <td>
              {model.embeddingsOnly && (
                <Tooltip
                  label='This model serves embeddings instead of chat. It is hidden from the chat and system model selects.'
                  openDelay={600}
                  events={{ hover: true, focus: true, touch: true }}
                  multiline
                  w={260}
                >
                  <Badge
                    color='teal'
                    variant='light'
                    data-testid={`${model.id}-embeddings-badge`}
                  >
                    Embeddings
                  </Badge>
                </Tooltip>
              )}
            </td>
            <td colSpan={1}>
              <Group>
                <ActionIcon
                  onClick={handleEditModel}
                  data-testid={`${model.id}-edit`}
                  aria-label={`Edit model ${model.name}`}
                >
                  <IconPencil />
                </ActionIcon>
                <ActionIcon
                  onClick={openDeleteAiProviderModelModal}
                  data-testid={`${model.id}-delete`}
                  aria-label={`Delete model ${model.name}`}
                >
                  <IconTrash />
                </ActionIcon>
                {/* The test sends a chat completion, which an embedding model
                    cannot serve: it would fail and blame the admin's credentials
                    for a correct configuration. */}
                {!model.embeddingsOnly && (
                  <Tooltip
                    label={
                      !isTestingThisModel
                        ? 'Test AI provider and model configuration'
                        : undefined
                    }
                    openDelay={600}
                    events={{ hover: true, focus: true, touch: true }}
                  >
                    <Button
                      leftIcon={
                        <ThemeIcon size='sm' variant='noHover'>
                          <IconActivity />
                        </ThemeIcon>
                      }
                      size='xs'
                      data-testid={`${model.id}-test`}
                      onClick={handleTestModelButtonClick}
                      loading={isTestingThisModel}
                    >
                      Test Model
                    </Button>
                  </Tooltip>
                )}
              </Group>
            </td>
          </>
        )}
      </tr>
    </>
  );
}
