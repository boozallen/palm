import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import AddAgentForm from './AddAgentForm';
import useCreateAiAgent from '@/features/settings/api/ai-agents/create-ai-agent';
import { AiAgentLabels, AiAgentType } from '@/features/shared/types';
import { notifications } from '@mantine/notifications';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/ai-agents/create-ai-agent');

const createAgentMock = (useCreateAiAgent as jest.Mock);
const mutateAsync = jest.fn();

const setIsLoading = (isLoading: boolean) => {
  createAgentMock.mockReturnValue({
    mutateAsync,
    isPending: isLoading,
  });
};

const fillOutForm = async (name: string, description: string, type: AiAgentType) => {
  const agentType = screen.getByLabelText('Agent');
  const nameInput = screen.getByLabelText('Name');
  const descriptionInput = screen.getByLabelText('Description');

  fireEvent.mouseDown(agentType);

  const option = await screen.findByText(AiAgentLabels[type]);
  fireEvent.mouseDown(option);

  fireEvent.change(nameInput, { target: { value: name } });
  fireEvent.change(descriptionInput, { target: { value: description } });
};

describe('AddAgentForm', () => {
  const setFormCompleted = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    setIsLoading(false);
  });

  it('renders form fields', () => {
    render(<AddAgentForm setFormCompleted={setFormCompleted} />);

    const agentType = screen.getByLabelText('Agent');
    const nameInput = screen.getByLabelText('Name');
    const descriptionInput = screen.getByLabelText('Description');

    expect(agentType).toBeInTheDocument();
    expect(nameInput).toBeInTheDocument();
    expect(descriptionInput).toBeInTheDocument();
  });

  it('calls setFormCompleted on cancel', () => {
    render(<AddAgentForm setFormCompleted={setFormCompleted} />);

    const cancelButton = screen.getByText('Cancel');
    cancelButton.click();

    expect(setFormCompleted).toHaveBeenCalledWith(true);
  });

  it('calls mutateAsync on form submission', async () => {
    render(<AddAgentForm setFormCompleted={setFormCompleted} />);

    await fillOutForm('Test Agent', 'This is a test agent', AiAgentType.CERTA);

    const submitButton = screen.getByRole('button', { name: 'Add Agent' });
    fireEvent.click(submitButton);

    expect(mutateAsync).toHaveBeenCalledWith({
      label: 'Test Agent',
      description: 'This is a test agent',
      type: AiAgentType.CERTA,
    });
  });

  it('changes button text if loading', async () => {
    setIsLoading(true);

    render(<AddAgentForm setFormCompleted={setFormCompleted} />);

    const button = screen.getByRole('button', { name: 'Adding Agent' });
    expect(button).toBeInTheDocument();
  });

  it('shows error notification on submission failure', async () => {
    const errorMessage = 'Error creating AI agent';
    mutateAsync.mockRejectedValue(new Error(errorMessage));

    render(<AddAgentForm setFormCompleted={setFormCompleted} />);

    await fillOutForm('Test Agent', 'This is a test agent', AiAgentType.CERTA);

    const submitButton = screen.getByRole('button', { name: 'Add Agent' });
    fireEvent.click(submitButton);

    waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          variant: 'failed_operation',
        })
      );
    });
  });

  it('offers PULSE as an agent type', async () => {
    render(<AddAgentForm setFormCompleted={setFormCompleted} />);

    fireEvent.mouseDown(screen.getByLabelText('Agent'));

    expect(await screen.findByText(AiAgentLabels[AiAgentType.PULSE])).toBeInTheDocument();
  });
});
