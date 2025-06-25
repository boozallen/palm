import React from 'react';
import { UnstyledButton, Center } from '@mantine/core';
import { IconMenu2, IconGridDots } from '@tabler/icons-react';

interface PromptViewToggleProps {
  isTableView: boolean;
  togglePromptsView: (flag: boolean) => void;
}

const PromptViewToggle: React.FC<PromptViewToggleProps> = ({ isTableView, togglePromptsView }) => {
  return (
    <div>
      <UnstyledButton
        variant='toggle_prompt_view'
        onClick={() => togglePromptsView(false)}
        className={isTableView ? '' : 'active'}
        aria-label='Card view'
      >
        <Center>
          <IconGridDots />
        </Center>
      </UnstyledButton>
      <UnstyledButton
        variant='toggle_prompt_view'
        onClick={() => togglePromptsView(true)}
        className={isTableView ? 'active' : ''}
        aria-label='Table view'
      >
        <Center>
          <IconMenu2 />
        </Center>
      </UnstyledButton>
    </div>
  );
};

export default PromptViewToggle;
