import { useEffect } from 'react';
import { z } from 'zod';
import { Group, NumberInput, Button, Table } from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';

import useGetUserAdvancedKbSettings from '@/features/shared/api/get-user-advanced-kb-settings';
import useUpdateUserKbSettingsMinScore from '@/features/profile/api/update-user-kb-settings-min-score';
import useUpdateUserKbSettingsMaxResults from '@/features/profile/api/update-user-kb-settings-max-results';
import { minScore, maxResults } from '@/features/shared/utils/kbProvider';

type AdvancedSettingsFormValues = {
  minScore: number | '';
  maxResults: number | '';
};

const schema = z.object({
  minScore: z.union([z.number().min(0).max(1), z.literal('')]),
  maxResults: z.union([z.number().int().min(1).max(20), z.literal('')]),
});

export default function AdvancedKbSettingsTable() {
  const {
    data: userAdvancedKbSettings,
    isPending: userAdvancedKbSettingsPending,
  } = useGetUserAdvancedKbSettings();

  const {
    mutateAsync: updateUserKbSettingsMinScore,
    error: updateUserKbSettingsMinScoreError,
  } = useUpdateUserKbSettingsMinScore();

  const {
    mutateAsync: updateUserKbSettingsMaxResults,
    error: updateUserKbSettingsMaxResultsError,
  } = useUpdateUserKbSettingsMaxResults();

  const form = useForm<AdvancedSettingsFormValues>({
    initialValues: {
      minScore: '',
      maxResults: '',
    },
    validate: zodResolver(schema),
    validateInputOnChange: true,
  });

  useEffect(() => {
    if (!userAdvancedKbSettingsPending && userAdvancedKbSettings) {
      form.setValues({
        minScore: userAdvancedKbSettings.knowledgeBasesMinScore ?? '',
        maxResults: userAdvancedKbSettings.knowledgeBasesMaxResults ?? '',
      });
    }
  }, [userAdvancedKbSettingsPending, userAdvancedKbSettings]);

  const handleOperation = async (
    field: keyof AdvancedSettingsFormValues,
    operation: 'save' | 'reset'
  ) => {
    if (operation === 'reset') {
      form.setFieldValue(field, '');
    }

    const updateConfig = {
      minScore: {
        function: updateUserKbSettingsMinScore,
        error: updateUserKbSettingsMinScoreError,
        param: 'knowledgeBasesMinScore',
      },
      maxResults: {
        function: updateUserKbSettingsMaxResults,
        error: updateUserKbSettingsMaxResultsError,
        param: 'knowledgeBasesMaxResults',
      },
    };

    try {
      await updateConfig[field].function({
        [updateConfig[field].param]:
          operation === 'reset' ? null : form.values[field],
      } as { knowledgeBasesMinScore: number | null; knowledgeBasesMaxResults: number | null });
    } catch (error) {
      notifications.show({
        id: `${operation}-user-kb-settings-${field}-failed`,
        title: `Failed to ${operation === 'save' ? 'Update' : 'Reset'}`,
        message: (error as any)?.message ?? updateConfig[field].error?.message,
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
      });
    }
  };

  const handleSave = (field: keyof AdvancedSettingsFormValues) =>
    handleOperation(field, 'save');

  const handleReset = (field: keyof AdvancedSettingsFormValues) =>
    handleOperation(field, 'reset');

  if (userAdvancedKbSettingsPending) {
    return <div>Loading...</div>;
  }

  return (
    <Table data-testid='advanced-kb-settings-table'>
      <thead>
        <tr>
          <th>Advanced Settings</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            <Group align='end'>
              <NumberInput
                variant='default'
                label='Min Score'
                description={`Results below the minimum score (0-1.00) will be excluded. Defaults to ${minScore}.`}
                placeholder='Enter a value (0-1.00)'
                {...form.getInputProps('minScore')}
                step={0.01}
                precision={2}
                hideControls
                mb='0'
                w='35%'
              />
              <Button
                onClick={() => handleSave('minScore')}
                disabled={
                  !form.values['minScore'] ||
                  !!form.errors['minScore'] ||
                  form.values['minScore'] ===
                  userAdvancedKbSettings?.knowledgeBasesMinScore
                }
              >
                Save
              </Button>
              <Button
                variant='outline'
                onClick={() => handleReset('minScore')}
                disabled={!userAdvancedKbSettings?.knowledgeBasesMinScore}
              >
                Reset
              </Button>
            </Group>
          </td>
        </tr>
        <tr>
          <td>
            <Group align='end'>
              <NumberInput
                variant='default'
                label='Max Results'
                description={`Adjust to control the maximum number of citations (1-20) retrieved from the knowledge bases. Defaults to ${maxResults}.`}
                placeholder='Enter a value (1-20)'
                {...form.getInputProps('maxResults')}
                step={1}
                precision={0}
                hideControls
                mb='0'
                w='35%'
              />
              <Button
                onClick={() => handleSave('maxResults')}
                disabled={
                  !form.values['maxResults'] ||
                  !!form.errors['maxResults'] ||
                  form.values['maxResults'] ===
                  userAdvancedKbSettings?.knowledgeBasesMaxResults
                }
              >
                Save
              </Button>
              <Button
                variant='outline'
                onClick={() => handleReset('maxResults')}
                disabled={!userAdvancedKbSettings?.knowledgeBasesMaxResults}
              >
                Reset
              </Button>
            </Group>
          </td>
        </tr>
      </tbody>
    </Table>
  );
}
