import { Button, Group, NumberInput, Select, Textarea } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useCreateSwearChecklistItem from '@/features/settings/api/ai-agents/swear/create-swear-checklist-item';
import { ChecklistItemForm, checklistItemForm } from '@/features/settings/types/ai-agent';

// Standard categories from the search warrant checklist
const CHECKLIST_CATEGORIES = [
  { value: 'Preliminary Information', label: 'I. Preliminary Information' },
  { value: 'Probable Cause', label: 'II. Probable Cause' },
  { value: 'Particularity', label: 'III. Particularity' },
  { value: 'Service of the Warrant', label: 'IV. Service of the Warrant' },
  { value: 'Administrative and Procedural Concerns', label: 'V. Administrative and Procedural Concerns' },
];

type AddChecklistItemFormProps = Readonly<{
  aiAgentId: string;
  closeForm: React.Dispatch<React.SetStateAction<boolean>>;
}>;

export default function AddChecklistItemForm({
  aiAgentId,
  closeForm,
}: AddChecklistItemFormProps) {
  const addChecklistItemForm = useForm<ChecklistItemForm>({
    initialValues: {
      category: '',
      item: '',
      sortOrder: 0,
    },
    validate: zodResolver(checklistItemForm),
  });

  const {
    mutateAsync: createSwearChecklistItem,
    isPending: createChecklistItemIsPending,
    error: createChecklistItemError,
  } = useCreateSwearChecklistItem();

  const handleSubmit = async (values: ChecklistItemForm) => {
    try {
      await createSwearChecklistItem({
        ...values,
        category: values.category.trim(),
        item: values.item.trim(),
        aiAgentId,
      });
      handleFormCompletion();
    } catch (error) {
      notifications.show({
        title: 'Failed to Create Checklist Item',
        message:
          createChecklistItemError?.message ??
          'There was a problem creating the checklist item',
        icon: <IconX />,
        autoClose: false,
        withCloseButton: true,
        variant: 'failed_operation',
      });
    }
  };

  const handleFormCompletion = () => {
    addChecklistItemForm.reset();
    closeForm(true);
  };

  return (
    <form onSubmit={addChecklistItemForm.onSubmit(handleSubmit)}>
      <Select
        label='Category'
        placeholder='Select a category'
        data={CHECKLIST_CATEGORIES}
        {...addChecklistItemForm.getInputProps('category')}
      />
      <Textarea
        label='Checklist Item'
        placeholder='Enter the checklist item question'
        minRows={3}
        maxRows={6}
        autosize
        {...addChecklistItemForm.getInputProps('item')}
      />
      <NumberInput
        label='Sort Order'
        placeholder='Enter sort order within category'
        min={0}
        {...addChecklistItemForm.getInputProps('sortOrder')}
      />
      <Group spacing='lg' grow mt='md'>
        <Button variant='outline' onClick={handleFormCompletion}>
          Cancel
        </Button>
        <Button type='submit' loading={createChecklistItemIsPending}>
          {!createChecklistItemIsPending ? 'Add Item' : 'Adding Item'}
        </Button>
      </Group>
    </form>
  );
}
