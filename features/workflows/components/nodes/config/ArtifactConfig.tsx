/**
 * Report Generator Configuration Form
 */

import { forwardRef, LegacyRef, useEffect } from 'react';
import { Grid, TextInput, Select, Group, ThemeIcon, Text } from '@mantine/core';
import { WORKFLOW_ARTIFACT_FILE_TYPES, WorkflowArtifactFileType } from '@/features/shared/types/document';
import { getFileTypeConfig } from '@/features/chat/utils/chatHelperFunctions';

const DEFAULT_FILE_FORMAT = '.docx';

interface ArtifactConfigProps {
  config: {
    format?: WorkflowArtifactFileType;
    filename?: string;
  };
  onChange: (config: any) => void;
}

interface ItemProps extends React.ComponentPropsWithoutRef<'div'> {
  value: string;
  label: string;
}

const SelectItem = forwardRef<HTMLDivElement, ItemProps>(
  ({ label, ...others }: ItemProps, ref: LegacyRef<HTMLDivElement> | undefined) => {
    const { color, icon: Icon } = getFileTypeConfig(`example${label}`);
    return (
      <div ref={ref} {...others}>
        <Group spacing='xs'>
          <ThemeIcon size='sm' c={color} style={{ backgroundColor: 'transparent' }}>
            <Icon size={16} stroke={2} />
          </ThemeIcon>
          <Text size='sm'>{label}</Text>
        </Group>
      </div>
    );
  }
);

SelectItem.displayName = 'SelectItem';

export default function ArtifactConfig({ config, onChange }: Readonly<ArtifactConfigProps>) {
  const formatOptions = WORKFLOW_ARTIFACT_FILE_TYPES.map((format) => ({
    value: format,
    label: format,
  }));

  // Set default format if not already configured
  useEffect(() => {
    if (!config.format) {
      onChange({ ...config, format: DEFAULT_FILE_FORMAT });
    }
  }, [config, onChange]);

  return (
    <Grid>
      <Grid.Col span={9}>
        <TextInput
          label='Filename'
          placeholder='Report'
          value={config.filename || ''}
          onChange={(e) => onChange({ ...config, filename: e.currentTarget.value })}
        />
      </Grid.Col>
      <Grid.Col span={3}>
        <Select
          label='Format'
          placeholder='Select format'
          value={config.format}
          defaultValue={DEFAULT_FILE_FORMAT}
          onChange={(value) => onChange({ ...config, format: value })}
          data={formatOptions}
          itemComponent={SelectItem}
          required
          withinPortal
        />
      </Grid.Col>
    </Grid>
  );
}
