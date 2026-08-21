import {
  Accordion,
  Button,
  Checkbox,
  Group,
  Text,
  Textarea,
} from '@mantine/core';

import type {
  OdramDocumentMapping,
  OdramQuestionContext,
} from '@/features/ai-agents/utils/odram/worker/queue';

type QuestionInfo = { id: number; name: string };

type DocumentPickerProps = Readonly<{
  questions: QuestionInfo[];
  fileNames: string[];
  mapping: OdramDocumentMapping;
  onChange: (mapping: OdramDocumentMapping) => void;
  questionContext: OdramQuestionContext;
  onContextChange: (context: OdramQuestionContext) => void;
  disabled?: boolean;
}>;

export default function DocumentPicker({
  questions,
  fileNames,
  mapping,
  onChange,
  questionContext,
  onContextChange,
  disabled,
}: DocumentPickerProps) {
  const handleSelectAll = () => {
    const next: OdramDocumentMapping = {};
    for (const q of questions) {
      next[q.id] = [...fileNames];
    }
    onChange(next);
  };

  const handleClearAll = () => {
    const next: OdramDocumentMapping = {};
    for (const q of questions) {
      next[q.id] = [];
    }
    onChange(next);
  };

  const handleQuestionChange = (questionId: number, selected: string[]) => {
    onChange({ ...mapping, [questionId]: selected });
  };

  const handleContextChange = (questionId: number, value: string) => {
    onContextChange({ ...questionContext, [questionId]: value });
  };

  return (
    <div>
      <Group position='right' mb='xs'>
        <Group spacing='xs'>
          <Button
            variant='subtle'
            size='xs'
            onClick={handleSelectAll}
            disabled={disabled}
          >
            Select All
          </Button>
          <Button
            variant='subtle'
            size='xs'
            onClick={handleClearAll}
            disabled={disabled}
          >
            Clear All
          </Button>
        </Group>
      </Group>

      <Accordion variant='separated' chevronPosition='left'>
        {questions.map((question) => {
          const selected = mapping[question.id] ?? fileNames;
          const count = selected.length;

          return (
            <Accordion.Item key={question.id} value={String(question.id)}>
              <Accordion.Control disabled={disabled}>
                <Group spacing='xs'>
                  <Text size='sm' fw={500}>Q{question.id}.</Text>
                  <Text size='sm'>{question.name}</Text>
                  <Text size='xs' color='dimmed'>
                    ({count}/{fileNames.length} docs)
                  </Text>
                </Group>
              </Accordion.Control>
              <Accordion.Panel>
                <Checkbox.Group
                  value={selected}
                  onChange={(val) => handleQuestionChange(question.id, val)}
                  mt='xs'
                >
                  {fileNames.map((name) => (
                    <Checkbox
                      key={name}
                      value={name}
                      label={name}
                      mb='xs'
                      disabled={disabled}
                    />
                  ))}
                </Checkbox.Group>
                <Textarea
                  mt='md'
                  placeholder='Optional: additional context for this question...'
                  value={questionContext[question.id] ?? ''}
                  onChange={(e) => handleContextChange(question.id, e.currentTarget.value)}
                  disabled={disabled}
                  autosize
                  minRows={3}
                  maxRows={6}
                  size='sm'
                />
              </Accordion.Panel>
            </Accordion.Item>
          );
        })}
      </Accordion>
    </div>
  );
}
