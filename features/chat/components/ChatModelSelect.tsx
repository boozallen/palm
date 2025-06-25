import { Box, Select, Tooltip } from '@mantine/core';
import { useEffect, useMemo, useRef } from 'react';
import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetAvailableModels from '@/features/shared/api/get-available-models';

export default function ChatModelSelect() {
  const { chatId, modelId, setModelId } = useChat();

  const {
    data: modelData,
    isError: modelsIsError,
    error: modelsError,
  } = useGetAvailableModels();

  // Users may only select a model for new chats
  const canSelectModel = chatId === null;

  const selectRef = useRef<HTMLInputElement>(null);

  const modelOptions = useMemo(() => {
    if (!modelData) {
      return [];
    }

    return modelData.availableModels.map((model) => ({
      value: model.id,
      label: model.name,
      group: model.providerLabel,
    }));
  }, [modelData]);

  useEffect(() => {
    if (modelOptions.length && selectRef.current) {
      selectRef.current.focus();
    }
  }, [modelOptions.length]);

  const selectPlaceholder = modelOptions.length ?
    'Select a model' : 'No models available';

  if (modelsIsError) {
    return <Box>{modelsError.message}</Box>;
  }

  const handleModelChange = (value: string) => {
    setModelId(value);
  };

  return (
    <Tooltip
      label='Unable to change model selection once conversation has begun'
      disabled={canSelectModel}
      // Explicitly set events to prevent tooltip from showing whenever disabled prop changes value
      events={{ 'hover': true, 'focus': true, 'touch': true }}
    >
      <div>
        <Select
          aria-label={selectPlaceholder}
          ref={selectRef}
          data={modelOptions}
          p='lg'
          mb={0}
          value={modelId}
          placeholder={canSelectModel ? selectPlaceholder : ''}
          onChange={handleModelChange}
          data-testid='model-select'
          disabled={!modelOptions.length || !canSelectModel}
          initiallyOpened={canSelectModel}
        />
      </div>
    </Tooltip>
  );
};
