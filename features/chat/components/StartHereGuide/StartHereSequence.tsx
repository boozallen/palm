import { Box, Button, Group, Stack, Text } from '@mantine/core';
import React, { useCallback, useState } from 'react';

import ChooseModelStep from './steps/ChooseModelStep';
import UploadDocumentStep from './steps/UploadDocumentStep';
import AskQuestionStep from './steps/AskQuestionStep';
import GetAnswerStep from './steps/GetAnswerStep';
import { STEP_ORDER, STEP_COUNT, STEP_CONTENT, StepId, StepProps } from './steps/content';

const STEP_COMPONENTS: Record<StepId, React.ComponentType<StepProps>> = {
  model: ChooseModelStep,
  upload: UploadDocumentStep,
  ask: AskQuestionStep,
  answer: GetAnswerStep,
};

export default function StartHereSequence({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  // Gates the Next button until the current step's animation has played through.
  const [completed, setCompleted] = useState<Record<number, boolean>>({});
  const stepId = STEP_ORDER[index];
  const isLast = index === STEP_COUNT - 1;
  const canAdvance = completed[index];

  const handleComplete = useCallback(() => {
    setCompleted((prev) => (prev[index] ? prev : { ...prev, [index]: true }));
  }, [index]);

  const goNext = () => {
    if (!canAdvance) {
      return;
    }
    if (isLast) {
      onDone();
      return;
    }
    setIndex((i) => Math.min(i + 1, STEP_COUNT - 1));
  };

  const goBack = () => setIndex((i) => Math.max(i - 1, 0));

  return (
    <Stack spacing='sm'>
      <Box>
        <Text weight={600} color='white'>{STEP_CONTENT[stepId].title}</Text>
        <Text size='sm' color='gray.4' mt={4}>{STEP_CONTENT[stepId].caption}</Text>
      </Box>

      {STEP_ORDER.map((id, i) => {
        const StepComponent = STEP_COMPONENTS[id];
        if (i !== index) {
          return null;
        }
        return <StepComponent key={id} active onComplete={handleComplete} />;
      })}

      <Group position='apart' align='center'>
        <Button variant='subtle' color='gray' onClick={goBack} disabled={index === 0}>
          Back
        </Button>

        <Group spacing={6} role='group' aria-label={`Step ${index + 1} of ${STEP_COUNT}`}>
          {STEP_ORDER.map((id, i) => (
            <Box
              key={id}
              sx={(theme) => ({
                width: 7,
                height: 7,
                borderRadius: '50%',
                backgroundColor: i === index ? theme.colors.orange[5] : theme.colors.dark[4],
              })}
            />
          ))}
        </Group>

        <Button onClick={goNext} disabled={!canAdvance}>{isLast ? 'Done' : 'Next'}</Button>
      </Group>
    </Stack>
  );
}
