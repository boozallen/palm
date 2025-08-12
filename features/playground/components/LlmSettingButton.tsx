import {
  Button,
  Group,
  Menu,
  Slider,
  Text,
  ThemeIcon,
  Tooltip,
} from '@mantine/core';
import { IconAdjustmentsHorizontal, IconInfoCircle } from '@tabler/icons-react';

interface LlmSettingButtonProps {
  navigateToCreatePrompt: () => void;
  inputArea: string;
  form: any;
  config: any;
}

export default function LlmSettingButton(
  props: Readonly<LlmSettingButtonProps>
) {
  const { form, inputArea, navigateToCreatePrompt, config } = props;

  const randomnessField =
    inputArea === 'left' ? 'config1.randomness' : 'config2.randomness';
  const repetitivenessField =
    inputArea === 'left' ? 'config1.repetitiveness' : 'config2.repetitiveness';

  return (
    <Menu
      closeOnItemClick={false}
      position='bottom-end'
      offset={5}
      shadow='md'
      width={200}
    >
      <Menu.Target>
        <Button
          mt='xs'
          mx='lg'
          px='sm'
          variant='default'
          radius='xl'
          disabled={!config.model}
          aria-label='LLM settings'
        >
          {
            <ThemeIcon c={'gray.6'}>
              <IconAdjustmentsHorizontal stroke={1.25} />
            </ThemeIcon>
          }
        </Button>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label fz='sm' c='gray.0' p='sm'>
          LLM Settings
        </Menu.Label>
        <Menu.Item>
          <Group spacing={'xs'}>
            <Text variant='slider_label'>
              {'Randomness (' + config.randomness + ')'}
            </Text>
            <Tooltip label={'How creative the AI can be'}>
              <ThemeIcon size={'xs'}>
                <IconInfoCircle />
              </ThemeIcon>
            </Tooltip>
          </Group>
          <Slider
            thumbLabel={'Randomness'}
            value={config.randomness}
            onChange={(value) => form.setFieldValue(randomnessField, value)}
            onChangeEnd={(value) => form.setFieldValue(randomnessField, value)}
          />
          <Group spacing={'xs'}>
            <Text variant='slider_label'>
              {'Repetitiveness (' + config.repetitiveness + ')'}
            </Text>
            <Tooltip label={'How repetitive the AI can be'}>
              <ThemeIcon size={'xs'}>
                <IconInfoCircle />
              </ThemeIcon>
            </Tooltip>
          </Group>
          <Slider
            thumbLabel={'Repetitiveness'}
            value={config.repetitiveness}
            onChange={(value) => form.setFieldValue(repetitivenessField, value)}
            onChangeEnd={(value) =>
              form.setFieldValue(repetitivenessField, value)
            }
          />
        </Menu.Item>

        <Menu.Divider />
        <Menu.Item
          sx={(theme) => ({
            color: theme.colors.blue[5],
            fontSize: theme.fontSizes.md,
          })}
          closeMenuOnClick={true}
          disabled={form.values.exampleInput === ''}
          onClick={navigateToCreatePrompt}
        >
          Save as New Prompt
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
