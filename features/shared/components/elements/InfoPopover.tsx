import { Popover, Stack, Table, Text, ThemeIcon } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import { IconInfoCircle } from '@tabler/icons-react';

type ParameterGuide = Readonly<{
  summary: string;
  rows: ReadonlyArray<Readonly<{ range: string; effect: string; bestFor: string }>>;
}>;

const PARAMETER_GUIDES: Record<string, ParameterGuide> = {
  Temperature: {
    summary: 'Adjusts the level of randomness in generated output. Lower values produce more focused, consistent responses, while higher values introduce more variety and creativity.',
    rows: [
      { range: '0 – 0.3', effect: 'Focused, deterministic', bestFor: 'Factual tasks, structured output' },
      { range: '0.3 – 0.7', effect: 'Balanced creativity', bestFor: 'General-purpose use' },
      { range: '0.7 – 1.0', effect: 'High variety, creative', bestFor: 'Brainstorming, creative writing' },
    ],
  },
  'Top P': {
    summary: 'Controls word diversity via nucleus sampling. A higher top_p means the model looks at more possible words, making the output more diverse.',
    rows: [
      { range: '0.1 – 0.3', effect: 'Only top word choices', bestFor: 'Precise, factual responses' },
      { range: '0.3 – 0.7', effect: 'Moderate word variety', bestFor: 'General-purpose use' },
      { range: '0.7 – 1.0', effect: 'Wide range of words', bestFor: 'Diverse, exploratory output' },
    ],
  },
};

function GuideTable({ guide }: Readonly<{ guide: ParameterGuide }>) {
  return (
    <Stack spacing={6}>
      <Text size='sm'>{guide.summary}</Text>
      <Table
        variant='default'
        fontSize='xs'
      >
        <thead>
          <tr>
            <th>Range</th>
            <th>Effect</th>
            <th>Best for</th>
          </tr>
        </thead>
        <tbody>
          {guide.rows.map((row) => (
            <tr key={row.range}>
              <td>{row.range}</td>
              <td>{row.effect}</td>
              <td>{row.bestFor}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Stack>
  );
}

type InfoPopoverProps = Readonly<{
  label: string;
}>;

export default function InfoPopover({ label }: InfoPopoverProps) {
  const [opened, { close, open }] = useDisclosure(false);
  const guide = PARAMETER_GUIDES[label];

  return (
    <Popover
      width={420}
      position='top'
      withArrow
      shadow='md'
      opened={opened}
    >
      <Popover.Target>
        <ThemeIcon
          size='xs'
          onMouseEnter={open}
          onMouseLeave={close}
          style={{ cursor: 'pointer' }}
        >
          <IconInfoCircle />
        </ThemeIcon>
      </Popover.Target>
      <Popover.Dropdown sx={{ pointerEvents: 'none' }}>
        {guide && <GuideTable guide={guide} />}
      </Popover.Dropdown>
    </Popover>
  );
}
