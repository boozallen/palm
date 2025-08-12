import { Accordion, Grid, Space, Text, Textarea } from '@mantine/core';
import { UseFormReturnType } from '@mantine/form';

import AiConfigSlider from './AiConfigSlider';
import ModelSelect from './ModelSelect';
import { RunPromptForm } from '@/features/shared/types';

interface InstructionsAndParametersProps {
  form: UseFormReturnType<RunPromptForm>
}

const InstructionsAndParameters: React.FC<InstructionsAndParametersProps> = ({
  form,
}) => {
  const title = 'Instructions and parameters';

  return (
    <Accordion
      defaultValue={title}
      variant='instructions_and_parameters'
    >
      <Accordion.Item value={title}>
        <Accordion.Control fz='sm' c='gray.0'>
          <Text pl='md'>{title}</Text>
        </Accordion.Control>
        <Accordion.Panel px='md'>
          <Grid grow gutter='xl'>
            <Grid.Col span={8}>
              <Textarea
                label=''
                placeholder='Enter your instructions here to generate a response.'
                autosize
                minRows={12}
                maxRows={12}
                mb='0'
                {...form.getInputProps('instructions')}
                error={!form.isValid('instructions')}
              />
            </Grid.Col>
            <Grid.Col span={1}>
              <AiConfigSlider
                label='Randomness'
                description='How creative the AI can be'
                {...form.getInputProps('config.randomness')}
              />
              <AiConfigSlider
                label='Repetitiveness'
                description='How repetitive the AI can be'
                {...form.getInputProps('config.repetitiveness')}
              />
              <Space h='xs' />
              <ModelSelect
                {...form.getInputProps('config.model')}
                setValue={
                  (value: string) => form.setFieldValue('config.model', value)
                }
              />
            </Grid.Col>
          </Grid>
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion>
  );
};

export default InstructionsAndParameters;
