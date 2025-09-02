import { useRouter } from 'next/router';
import { Text } from '@mantine/core';

import { useGetPrompt } from '@/features/library/api/get-prompt';
import PromptDetailsContainer from '@/features/library/components/PromptDetailsContainer';

export default function PromptHandler() {
  const router = useRouter();
  const { promptId } = router.query;

  const { data: promptData, isPending: loadingPrompt } = useGetPrompt({
    promptId: promptId as string,
  });

  if (loadingPrompt) {
    return <Text>Loading...</Text>;
  }

  if (!promptData?.prompt) {
    return <Text>Not found</Text>;
  }

  const prompt = promptData.prompt;

  return <PromptDetailsContainer prompt={prompt} />;
}
