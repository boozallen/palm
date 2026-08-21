import { Button, Group, NumberInput, Select, Textarea } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useUpdateSwearChecklistItem from '@/features/settings/api/ai-agents/swear/update-swear-checklist-item';
import { ChecklistItemForm, checklistItemForm } from '@/features/settings/types/ai-agent';

// Standard categories from the search warrant checklist
const CHECKLIST_CATEGORIES = [
  { value: 'Preliminary Information', label: 'I. Preliminary Information' },
  { value: 'Probable Cause', label: 'II. Probable Cause' },
  { value: 'Particularity', label: 'III. Particularity' },
  { value: 'Service of the Warrant', label: 'IV. Service of the Warrant' },
  { value: 'Administrative and Procedural Concerns', label: 'V. Administrative and Procedural Concerns' },
];

type EditChecklistItemFormProps = Readonly<{
  checklistItemId: string;
  initialValues: ChecklistItemForm;
  closeForm: React.Dispatch<React.SetStateAction<boolean>>;
}>;

export default function EditChecklistItemForm({
  checklistItemId,
  initialValues,
  closeForm,
}: EditChecklistItemFormProps) {
  const editChecklistItemForm = useForm<ChecklistItemForm>({
    initialValues,
    validate: zodResolver(checklistItemForm),
  });

  const {
    mutateAsync: updateSwearChecklistItem,
    isPending: updateChecklistItemIsPending,
    error: updateChecklistItemError,
  } = useUpdateSwearChecklistItem();

  const handleSubmit = async (values: ChecklistItemForm) => {
    try {
      await updateSwearChecklistItem({
        id: checklistItemId,
        category: values.category.trim(),
        item: values.item.trim(),
        sortOrder: values.sortOrder,
      });
      handleFormCompletion();
    } catch (error) {
      notifications.show({
        title: 'Failed to Update Checklist Item',
        message:
          updateChecklistItemError?.message ??
          'There was a problem updating the checklist item',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  const handleFormCompletion = () => {
    editChecklistItemForm.reset();
    closeForm(true);
  };

  return (
    <form onSubmit={editChecklistItemForm.onSubmit(handleSubmit)}>
      <Select
        label='Category'
        placeholder='Select a category'
        data={CHECKLIST_CATEGORIES}
        {...editChecklistItemForm.getInputProps('category')}
      />
      <Textarea
        label='Checklist Item'
        placeholder='Enter the checklist item question'
        minRows={3}
        maxRows={6}
        autosize
        {...editChecklistItemForm.getInputProps('item')}
      />
      <NumberInput
        label='Sort Order'
        placeholder='Enter sort order within category'
        min={0}
        {...editChecklistItemForm.getInputProps('sortOrder')}
      />
      <Group spacing='lg' grow mt='md'>
        <Button variant='outline' onClick={handleFormCompletion}>
          Cancel
        </Button>
        <Button type='submit' loading={updateChecklistItemIsPending}>
          {!updateChecklistItemIsPending ? 'Update Item' : 'Updating Item'}
        </Button>
      </Group>
    </form>
  );
}
