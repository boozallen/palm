import { Tooltip, ActionIcon } from '@mantine/core';
import { IconListSearch } from '@tabler/icons-react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import { AiProviderType } from '@/features/shared/types/ai-provider';
import useGetAvailableModels from '@/features/shared/api/get-available-models';

export default function ChatDeepResearchButton() {
  const {
    data: modelData,
    isPending: modelDataIsPending,
  } = useGetAvailableModels();

  const { deepResearchEnabled, setDeepResearchEnabled, modelId } = useChat();

  const selectedModel = modelData?.availableModels?.find(model => model.id === modelId);
  const modelSelectedIsOpenAiProvider = selectedModel?.aiProviderTypeId === AiProviderType.OpenAi;

  if (modelDataIsPending) {
    return <></>;
  }

  if (!modelSelectedIsOpenAiProvider) {
    return <></>;
  }

  return (
    <Tooltip
      label='Use deep research to search the web and enhance your response'
      multiline
      w={250}
      events={{ 'hover': true, 'focus': true, 'touch': true }}
    >
      <ActionIcon
        mt='xs'
        data-testid='chat-deep-research-button'
        variant={deepResearchEnabled ? 'filled' : 'default'}
        color={deepResearchEnabled ? 'blue' : 'gray'}
        size='lg'
        onClick={() => setDeepResearchEnabled(!deepResearchEnabled)}
      >
        <IconListSearch size={20} />
      </ActionIcon>
    </Tooltip>
  );
}
