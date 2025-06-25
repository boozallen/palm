import {
  Box,
  Button,
  Group,
  Select,
  Textarea,
  Space,
} from '@mantine/core';
import { useForm, zodResolver } from '@mantine/form';
import { useContext, useEffect, useState, useRef, JSX } from 'react';
import { useRouter } from 'next/router';
import { z } from 'zod';
import { useScrollIntoView } from '@mantine/hooks';
import LlmSettingButton from './LlmSettingButton';
import { AiSettings, AiSettingsSchema } from '@/types';
import { useRunMultiplePrompts } from '../api/run-multiple-prompts';
import { SafeExitContext } from '@/features/shared/utils';
import { AiResponse } from '@/features/ai-provider/sources/types';
import { useGetAiProviderModelSelectData } from '@/features/shared/data/ai-provider-model-select-data';
import PromptFormSubmission from '@/features/shared/components/forms/PromptFormSubmission';

export default function PromptPlaygroundForm() {
  interface FormValues {
    exampleInput: string;
    config1: AiSettings;
    config2: AiSettings;
  }

  const router = useRouter();
  const initializedRef = useRef(false);

  const { scrollIntoView, targetRef } = useScrollIntoView<HTMLDivElement>();

  const { setSafeExitFormToDirty } = useContext(SafeExitContext);

  const { modelOptions, modelsIsError, modelsError } = useGetAiProviderModelSelectData();

  const [secondResponse, setSecondResponse] = useState<string>('');
  const [firstResponse, setFirstResponse] = useState<string>('');
  const { mutateAsync: runMultiplePrompts, isPending, reset, error: runMultiplePromptsError } = useRunMultiplePrompts();
  const [hasPromptSubmissionError, setHasPromptSubmissionError] = useState<boolean>(false);

  const navigateToCreatePrompt = (currentConfig: 'config1' | 'config2') => {
    const promptData = {
      instructions: playgroundPromptForm.values.exampleInput.trim(),
      config: playgroundPromptForm.values[currentConfig],
      fullState: {
        instructions: playgroundPromptForm.values.exampleInput.trim(),
        config1: playgroundPromptForm.values.config1,
        config2: playgroundPromptForm.values.config2,
      },
    };

    router.push({
      pathname: '/library/add',
      query: {
        promptData: JSON.stringify(promptData),
        fromPlayground: 'true',
      },
    });
  };

  const playgroundPromptForm = useForm<FormValues>({
    validate: zodResolver(
      z.object({
        exampleInput: z.string().min(1, { message: 'Field required' }),
        config1: AiSettingsSchema,
        config2: AiSettingsSchema,
      })
    ),
    initialValues: {
      exampleInput: '',
      config1: {
        randomness: 0.25,
        model: '',
        repetitiveness: 0.25,
      },
      config2: {
        randomness: 0.25,
        model: '',
        repetitiveness: 0.25,
      },
    },
    initialTouched: {
      exampleInput: false,
    },
  });

  useEffect(() => {
    if (router.isReady && !initializedRef.current) {
      const { returnedPromptData } = router.query;
      if (typeof returnedPromptData === 'string') {
        try {
          const parsedData = JSON.parse(returnedPromptData);
          if (parsedData.fullState) {
            const { instructions, config1, config2 } = parsedData.fullState;
            playgroundPromptForm.setValues({
              exampleInput: instructions,
              config1: config1,
              config2: config2,
            });
          }
        } catch (error) {
          // Do nothing, the form will retain its current state
        }
      }
      initializedRef.current = true;
    }
  }, [playgroundPromptForm, router.isReady, router.query]);

  const inputPlaceholderText = 'Enter your input here to generate a response.';
  const [inputPlaceholder, setInputPlaceholder] = useState(inputPlaceholderText);

  const isSubmitDisabled = !playgroundPromptForm.isValid();

  function setConfig(inputArea: string, setSafeExitFormToDirty: any, config: any): JSX.Element {
    const configKey = inputArea === 'left' ? 'config1' : 'config2';
    const modelField = `${configKey}.model`;

    const handleModelChange = (value: string) => {

      playgroundPromptForm.setFieldValue(modelField, value);

      setSafeExitFormToDirty(true);
    };

    if (modelsIsError) {
      return <Box>{modelsError.message}</Box>;
    }

    return (
      <Box
        pt='md'
        sx={(theme) => ({
          width: '50%',
          borderRight: `1px solid ${theme.colors.dark[4]}`,
          paddingRight: `${theme.spacing.md}`,
          backgroundColor: theme.colors.dark[6],
        })}
      >
        <Box
          sx={(theme) => ({
            display: 'flex',
            justifyContent: 'center',
            paddingLeft: `${theme.spacing.xl}`,
          })}
        >
          <Select
            searchable
            placeholder='Select language model'
            value={playgroundPromptForm.values[configKey].model}
            nothingFound='No large language models available'
            size='sm'
            pt='xs'
            mb='xs'
            w='100%'
            onChange={handleModelChange}
            data={modelOptions}
          />
          <LlmSettingButton
            inputArea={inputArea}
            form={playgroundPromptForm}
            navigateToCreatePrompt={() => navigateToCreatePrompt(configKey)}
            config={config}
          />
        </Box>
        < Space h='xl' />
      </Box>
    );
  }

  function displayResponse(promptResponse: AiResponse): JSX.Element | null {
    const responsesAreReady = !isPending && secondResponse;
    const responseData = responsesAreReady ? { response: promptResponse } : undefined;

    return (
      <Box
        sx={(theme) => ({
          width: '50%',
          borderRight: `1px solid ${theme.colors.dark[4]}`,
        })}
      >
        <PromptFormSubmission
          hasPromptSubmissionError={hasPromptSubmissionError}
          errorMessage={runMultiplePromptsError?.message}
          isPending={isPending}
          data={responseData?.response}
        />
      </Box>
    );
  }

  const handleSubmit = async (values: FormValues) => {
    setHasPromptSubmissionError(false);
    const input1 = {
      exampleInput: values.exampleInput,
      config: values.config1,
    };
    const input2 = {
      exampleInput: values.exampleInput,
      config: values.config2,
    };

    try {
      const results = await runMultiplePrompts([input1, input2]);
      const [result1, result2] = results.aiResponse;
      setFirstResponse(result1.text);
      setSecondResponse(result2.text);
      scrollIntoView({ alignment: 'start' });
    } catch (error) {
      setHasPromptSubmissionError(true);
    }
  };

  const handleExampleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    event.preventDefault();
    const value = event.currentTarget.value;
    playgroundPromptForm.setFieldValue('exampleInput', value);
    if (!value) {
      setInputPlaceholder(inputPlaceholderText);
    }
    setSafeExitFormToDirty(playgroundPromptForm.isDirty());
  };

  return (

    <form
      onSubmit={playgroundPromptForm.onSubmit(handleSubmit)}
      onReset={() => {
        playgroundPromptForm.reset();
        reset();
      }}
    >
      <Textarea
        label='Prompt'
        placeholder={inputPlaceholder}
        autosize
        minRows={15}
        maxRows={15}
        p='xl'
        pt='md'
        bg='dark.5'
        mb='0'
        onChange={handleExampleInputChange}
        value={playgroundPromptForm.values.exampleInput}
      />
      <Group
        spacing={0}
        position='center'
        align='stretch'
        grow={false}
        noWrap={true}
      >
        {setConfig('left', setSafeExitFormToDirty, playgroundPromptForm.values.config1)}
        {setConfig('right', setSafeExitFormToDirty, playgroundPromptForm.values.config2)}
      </Group>

      <Box
        sx={(theme) => ({
          padding: `${theme.spacing.md} ${theme.spacing.xl}`,
          backgroundColor: theme.colors.dark[5],
          borderTop: `1px solid ${theme.colors.dark[4]} `,
        })}
      >

        <Button
          type='submit'
          loading={isPending}
          disabled={isSubmitDisabled}
        >
          Run Prompt
        </Button>
      </Box>

      <Group
        ref={targetRef}
        spacing={0}
        position='center'
        align='stretch'
        grow={false}
        noWrap={true}
      >
        {displayResponse({ text: firstResponse, inputTokensUsed: 0, outputTokensUsed: 0 })}
        {displayResponse({ text: secondResponse, inputTokensUsed: 0, outputTokensUsed: 0 })}
      </Group>
    </form>

  );
}
