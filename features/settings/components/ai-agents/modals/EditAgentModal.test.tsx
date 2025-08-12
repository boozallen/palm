import { render, screen } from '@testing-library/react';

import EditAgentModal from './EditAgentModal';
import { AiAgentType } from '@/features/shared/types';

jest.mock('@/features/settings/components/ai-agents/forms/EditAgentForm', () => {
  return jest.fn(() => <div>Edit Agent Form</div>);
});

describe('EditAgentModal', () => {
  const closeModalHandler = jest.fn();

  const mockAgent = {
    id: '27f6c8d9-7473-4406-a9b4-ddcc852e112b',
    name: 'Test Agent',
    description: 'This is a test agent',
    type: AiAgentType.CERTA,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal if it is opened', () => {
    const modalOpened = true;

    render(
      <EditAgentModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        agent={mockAgent}
      />
    );

    expect(screen.getByText('Edit AI Agent')).toBeInTheDocument();
  });

  it('renders form if modal is opened', () => {
    const modalOpened = true;

    render(
      <EditAgentModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        agent={mockAgent}
      />
    );

    expect(screen.getByText('Edit Agent Form')).toBeInTheDocument();
  });

  it('should not render the modal if it is closed', () => {
    const modalOpened = false;

    render(
      <EditAgentModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        agent={mockAgent}
      />
    );

    expect(screen.queryByText('Edit AI Agent')).not.toBeInTheDocument();
  });

  it('should not render form if modal is closed', () => {
    const modalOpened = false;

    render(
      <EditAgentModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        agent={mockAgent}
      />
    );

    expect(screen.queryByText('Edit Agent Form')).not.toBeInTheDocument();
  });
});
