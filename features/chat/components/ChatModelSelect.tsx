import { Box, Select, Tooltip } from '@mantine/core';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useChat } from '@/features/chat/providers/ChatProvider';
import useGetAvailableModels from '@/features/shared/api/get-available-models';
import useGetAvailableAgentProviders from '@/features/shared/api/get-available-agent-providers';
import { useJoinUserGroupCallout } from '@/features/shared/components/JoinUserGroupCallout/JoinUserGroupCalloutProvider';

const AGENT_PROVIDER_PREFIX = 'agent-provider::';

export default function ChatModelSelect() {
  const { chatId, modelId, setModelId, pendingMessage, setShowAgentOnboarding } = useChat();

  const {
    data: modelData,
    isError: modelsIsError,
    error: modelsError,
    isFetching: modelsIsFetching,
  } = useGetAvailableModels();

  const { data: agentProviderData } = useGetAvailableAgentProviders();

  const { isNonMember, requestExpandAndFocus } = useJoinUserGroupCallout();

  const selectRef = useRef<HTMLInputElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [inputWidth, setInputWidth] = useState<number | undefined>(undefined);
  const [dropdownWidth, setDropdownWidth] = useState<number | undefined>(undefined);

  const modelOptions = useMemo(() => {
    const models = modelData?.availableModels.map((model) => ({
      value: model.id,
      label: model.name,
      group: model.providerLabel,
    })) ?? [];

    const agents = agentProviderData?.availableAgentProviders.map((agent) => ({
      value: `${AGENT_PROVIDER_PREFIX}${agent.id}`,
      label: agent.name,
      group: 'Agents',
    })) ?? [];

    return [...models, ...agents];
  }, [modelData, agentProviderData]);

  const isChatModelAvailable = useMemo(() => {
    if (!modelId || !modelOptions.length) {
      return false;
    }
    return modelOptions.some(option => option.value === modelId);
  }, [modelId, modelOptions]);

  // Users may only select a model for new chats.
  const canSelectModel = chatId === null;

  // A non-member with no models should surface the join-group callout on click.
  const showJoinGroupPrompt = chatId === null && !modelOptions.length && isNonMember;

  const isLoading = pendingMessage !== null;

  const isAgentProviderChat = typeof modelId === 'string' && modelId.startsWith(AGENT_PROVIDER_PREFIX);

  let selectPlaceholder = 'Select a model';
  let tooltipPlaceholder = 'Unable to change model selection once conversation has begun';
  if (!chatId && !modelOptions.length) {
    selectPlaceholder = 'No models available';
  } else if (chatId && !isChatModelAvailable) {
    selectPlaceholder = isAgentProviderChat ? 'Agent unavailable' : 'Model unavailable';
    tooltipPlaceholder = isAgentProviderChat
      ? 'The agent associated with this chat is no longer available. Please start a new chat.'
      : 'The model associated with this chat has been deleted. Please start a new chat.';
  }

  // Preselect the first model for new chats only once fetching settles, to avoid stale cache data.
  useEffect(() => {
    if (chatId === null && modelOptions.length > 0 && !modelId && !modelsIsFetching) {
      setModelId(modelOptions[0].value);
    }
  }, [chatId, modelOptions, setModelId, modelId, modelsIsFetching]);

  useEffect(() => {
    const tempDiv = document.createElement('div');
    tempDiv.style.position = 'absolute';
    tempDiv.style.visibility = 'hidden';
    tempDiv.style.whiteSpace = 'nowrap';
    tempDiv.style.fontSize = '14px';

    document.body.appendChild(tempDiv);

    let textToMeasure = selectPlaceholder;
    if (modelId && modelOptions.length > 0) {
      const selectedOption = modelOptions.find(option => option.value === modelId);
      if (selectedOption) {
        textToMeasure = selectedOption.label;
      }
    }

    tempDiv.textContent = textToMeasure;
    const selectedTextWidth = tempDiv.offsetWidth;
    const calculatedInputWidth = selectedTextWidth + 52;

    let calculatedDropdownWidth = calculatedInputWidth;

    // Size the dropdown to the longest option.
    if (modelOptions.length > 0) {
      const allWidths = modelOptions.map(option => {
        tempDiv.textContent = option.label;
        return tempDiv.offsetWidth;
      });
      const maxOptionWidth = Math.max(...allWidths);
      calculatedDropdownWidth = maxOptionWidth + 52;
    }

    document.body.removeChild(tempDiv);

    setInputWidth(calculatedInputWidth);
    setDropdownWidth(calculatedDropdownWidth);
  }, [modelOptions, modelId, selectPlaceholder]);

  if (modelsIsError) {
    return <Box>{modelsError.message}</Box>;
  }

  const handleModelChange = (value: string) => {
    setModelId(value);
    if (value.startsWith(AGENT_PROVIDER_PREFIX)) {
      setShowAgentOnboarding(true);
    } else {
      setShowAgentOnboarding(false);
    }
  };

  return (
    <Tooltip
      label={tooltipPlaceholder}
      disabled={canSelectModel}
      // Explicit events prevent the tooltip from flashing when the disabled prop changes.
      events={{ 'hover': true, 'focus': true, 'touch': true }}
    >
      <div
        ref={measureRef}
        onClick={showJoinGroupPrompt ? requestExpandAndFocus : undefined}
        style={{
          width: inputWidth ? `${inputWidth}px` : undefined,
          maxWidth: '100%',
          overflow: 'hidden',
          cursor: showJoinGroupPrompt ? 'pointer' : undefined,
        }}
      >
        <Select
          variant='unstyled'
          aria-label={selectPlaceholder}
          ref={selectRef}
          data={modelOptions}
          mb={0}
          value={modelId}
          placeholder={selectPlaceholder}
          onChange={handleModelChange}
          data-testid='model-select'
          disabled={!modelOptions.length || !canSelectModel || isLoading}
          initiallyOpened={false}
          dropdownPosition='bottom'
          w='100%'
          styles={(theme) => ({
            input: {
              height: theme.spacing.xl,
              color: theme.colors.gray[6],
              textAlign: 'right',
              paddingRight: theme.spacing.xl,
              borderRadius: theme.radius.sm,
              '&:hover': {
                backgroundColor: theme.colors.dark[7],
              },
              '&:focus': {
                backgroundColor: theme.colors.dark[7],
                borderRadius: theme.radius.sm,
              },
              '&::placeholder': {
                color: theme.colors.gray[7],
              },
              '&:disabled': {
                color: theme.colors.gray[7],
              },
            },
            rightSection: {
              transform: 'translateX(-4px)',
              pointerEvents: 'none',
              display: 'flex',
              alignItems: 'center',
              'input:disabled ~ &': {
                display: 'flex !important',
                '& svg': {
                  color:  `${theme.colors.gray[8]} !important`,
                },
              },
              '& svg': {
                transform: 'scale(1.5) translateY(-16%)',
                clipPath: 'inset(50% 0 0 0)',
                color:  `${theme.colors.gray[8]} !important`,
              },
            },
            dropdown: {
              width: `${dropdownWidth}px !important`,
              minWidth: `${dropdownWidth}px !important`,
            },
          })}
        />
      </div>
    </Tooltip>
  );
};
