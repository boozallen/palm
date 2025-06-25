import { useRouter } from 'next/router';
import { Button } from '@mantine/core';

import { usePromptDetails } from '@/features/library/providers/PromptDetailsProvider';

const SaveCustomizedPromptButton: React.FC = () => {
  const router = useRouter();
  const { prompt, form } = usePromptDetails();

  const customizedInstructions = !!form.values.instructions &&
    (prompt.instructions !== form.values.instructions);

  const navigateToCreatePrompt = () => {
    const updatedPromptData = {
      instructions: form.values.instructions,
      config: form.values.config,
      title: prompt.title,
      summary: prompt.summary,
      description: prompt.description,
      example: prompt.example,
      tags: prompt.tags,
    };

    router.push({
      pathname: '/library/add',
      query: {
        promptData: JSON.stringify(updatedPromptData),
        fromLibrary: true,
        originalPath: router.asPath,
      },
    });
  };

  return (
    <Button
      disabled={!customizedInstructions}
      onClick={navigateToCreatePrompt}
    >
      Save Customized Prompt
    </Button>
  );
};

export default SaveCustomizedPromptButton;
