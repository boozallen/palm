import React from 'react';
import { UnstyledButton, Center } from '@mantine/core';
import { IconMenu2, IconGridDots } from '@tabler/icons-react';

interface WorkflowViewToggleProps {
  isTableView: boolean;
  toggleWorkflowsView: (flag: boolean) => void;
}

const WorkflowViewToggle: React.FC<WorkflowViewToggleProps> = ({ isTableView, toggleWorkflowsView }) => {
  return (
    <div>
      <UnstyledButton
        variant='toggle_prompt_view'
        onClick={() => toggleWorkflowsView(false)}
        className={isTableView ? '' : 'active'}
        aria-label='Card view'
      >
        <Center>
          <IconGridDots />
        </Center>
      </UnstyledButton>
      <UnstyledButton
        variant='toggle_prompt_view'
        onClick={() => toggleWorkflowsView(true)}
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

export default WorkflowViewToggle;
