import { ActionIcon, Group, Button, Tooltip, ThemeIcon } from '@mantine/core';
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
          <td colSpan={6}>
            <EditModelForm
              id={model.id}
              name={model.name}
              externalId={model.externalId}
              costPerMillionInputTokens={model.costPerMillionInputTokens}
              costPerMillionOutputTokens={model.costPerMillionOutputTokens}
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
              </Group>
            </td>
          </>
        )}
      </tr>
    </>
  );
}
