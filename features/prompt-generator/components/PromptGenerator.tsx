import { Stepper } from '@mantine/core';
import GeneratePromptInstructionsForm from '@/features/prompt-generator/components/forms/GeneratePromptInstructionsForm';
import GeneratedPromptForm from '@/features/prompt-generator/components/forms/GeneratedPromptForm';
import CreatePromptForm from '@/features/prompt-generator/components/forms/CreatePromptForm';
import { usePromptGenerator } from '@/features/prompt-generator/providers';

export default function PromptGenerator() {
  const { stepper } = usePromptGenerator();

  return (
    <Stepper
      active={stepper.currentStep}
      breakpoint='sm'
      size='sm'
    >
      {/*Step 1*/}
      <Stepper.Step
        allowStepSelect
        allowStepClick
        label='First step'
        description='Provide a basic prompt'
      >
        <GeneratePromptInstructionsForm />
      </Stepper.Step>

      {/*Step 2*/}
      <Stepper.Step
        allowStepClick
        allowStepSelect
        label='Second step'
        description='Tweak the instructions'
      >
        <GeneratedPromptForm />
      </Stepper.Step>

      {/*Step 3*/}
      <Stepper.Step
        allowStepClick
        allowStepSelect
        label='Third step'
        description='Name the prompt'
      >
        <CreatePromptForm />
      </Stepper.Step>
    </Stepper>
  );
}
