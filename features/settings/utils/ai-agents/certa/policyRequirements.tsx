import { notifications } from '@mantine/notifications';
import { IconX } from '@tabler/icons-react';
import { UseFormReturnType } from '@mantine/form';
import { PolicyForm } from '@/features/settings/types/ai-agent';

/**
 * Handles generating requirements using AI
 */
export const handleGenerateRequirements = async (
  form: UseFormReturnType<PolicyForm>,
  generateRequirements: (params: { policyContent: string }) => Promise<{ requirements: string }>,
): Promise<void> => {
  const content = form.values.content;
  if (!content.trim()) {
    return;
  }

  try {
    const result = await generateRequirements({
      policyContent: content,
    });
    
    if (result?.requirements) {
      form.setFieldValue('requirements', result.requirements);
    }
  } catch (error) {
    notifications.show({
      title: 'Requirements Generation Error',
      message:
        error instanceof Error
          ? error.message
          : 'Failed to generate requirements',
      icon: <IconX />,
      color: 'red',
      autoClose: true,
      variant: 'failed_operation',
    });
  }
};
