import {
  Button,
  Menu,
  ThemeIcon,
} from '@mantine/core';
import { IconAdjustmentsHorizontal } from '@tabler/icons-react';

import AiConfigSlider from '@/features/shared/components/forms/inputs/AiConfigSlider';

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

  const temperatureField =
    inputArea === 'left' ? 'config1.temperature' : 'config2.temperature';
  const topPField =
    inputArea === 'left' ? 'config1.topP' : 'config2.topP';

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
          <AiConfigSlider
            label='Temperature'
            value={config.temperature}
            onChange={(value) => form.setFieldValue(temperatureField, value)}
          />
          <AiConfigSlider
            label='Top P'
            value={config.topP}
            onChange={(value) => form.setFieldValue(topPField, value)}
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
