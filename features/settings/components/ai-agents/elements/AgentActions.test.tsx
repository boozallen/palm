import { useDisclosure } from '@mantine/hooks';
import { render, screen } from '@testing-library/react';

import AgentActions from './AgentActions';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@mantine/hooks');

jest.mock('@/features/settings/components/ai-agents/modals/EditAgentModal', () => {
  return jest.fn(() => <div>Edit Agent Modal</div>);
});

jest.mock('@/features/settings/components/ai-agents/modals/DeleteAgentModal', () => {
  return jest.fn(() => <div>Delete Agent Modal</div>);
});

describe('AgentActions', () => {
  let editAgentModelOpened = false;
  const openEditAgentModal = jest.fn(() => editAgentModelOpened = true);
  const closeEditAgentModal = jest.fn(() => editAgentModelOpened = false);

  let deleteAgentModelOpened = false;
  const openDeleteAgentModal = jest.fn(() => deleteAgentModelOpened = true);
  const closeDeleteAgentModal = jest.fn(() => deleteAgentModelOpened = false);

  const mockAgent = {
    id: '27f6c8d9-7473-4406-a9b4-ddcc852e112b',
    label: 'Test Agent',
    description: 'This is a test agent',
    type: AiAgentType.CERTA,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useDisclosure as jest.Mock).mockReturnValueOnce([
      editAgentModelOpened,
      { open: openEditAgentModal, close: closeEditAgentModal },
    ]);

    (useDisclosure as jest.Mock).mockReturnValueOnce([
      deleteAgentModelOpened,
      { open: openDeleteAgentModal, close: closeDeleteAgentModal },
    ]);
  });

  it('renders EditAgentModal', () => {
    render(<AgentActions {...mockAgent} />);

    const modal = screen.getByText('Edit Agent Modal');
    expect(modal).toBeInTheDocument();
  });

  it('renders DeleteAgentModal', () => {
    render(<AgentActions {...mockAgent} />);

    const modal = screen.getByText('Delete Agent Modal');
    expect(modal).toBeInTheDocument();
  });

  it('renders pencil icon', () => {
    render(<AgentActions {...mockAgent} />);

    const pencilIcon = screen.getByLabelText(`Edit ${mockAgent.label} Agent`);
    expect(pencilIcon).toBeInTheDocument();
  });

  it('renders trash icon', () => {
    render(<AgentActions {...mockAgent} />);

    const trashIcon = screen.getByLabelText(`Delete ${mockAgent.label} Agent`);
    expect(trashIcon).toBeInTheDocument();
  });

  it('opens EditAgentModal on pencil icon click', () => {
    render(<AgentActions {...mockAgent} />);

    const pencilIcon = screen.getByLabelText(`Edit ${mockAgent.label} Agent`);
    pencilIcon.click();

    expect(openEditAgentModal).toHaveBeenCalled();
    expect(editAgentModelOpened).toBe(true);
  });

  it('opens DeleteAgentModal on trash icon click', () => {
    render(<AgentActions {...mockAgent} />);

    const trashIcon = screen.getByLabelText(`Delete ${mockAgent.label} Agent`);
    trashIcon.click();

    expect(openDeleteAgentModal).toHaveBeenCalled();
    expect(deleteAgentModelOpened).toBe(true);
  });
});
