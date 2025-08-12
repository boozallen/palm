import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import EditAgentForm from './EditAgentForm';
import { AiAgentLabels, AiAgentType } from '@/features/shared/types';
import useUpdateAiAgent from '@/features/settings/api/ai-agents/update-ai-agent';
import { notifications } from '@mantine/notifications';

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/ai-agents/update-ai-agent');

const updateAgentMock = (useUpdateAiAgent as jest.Mock);
const mutateAsync = jest.fn();

const setIsLoading = (isLoading: boolean) => {
  updateAgentMock.mockReturnValue({
    mutateAsync,
    isPending: isLoading,
    error: null,
  });
};

describe('EditAgentForm', () => {
  const setFormCompleted = jest.fn();

  const mockAgent = {
    id: 'c82369d7-af90-415b-9857-d64b89981ed1',
    name: 'Test Agent',
    description: 'This is a test agent',
    type: AiAgentType.CERTA,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    setIsLoading(false);
  });

  it('renders type, name, and description form fields', () => {
    render(<EditAgentForm agent={mockAgent} setFormCompleted={setFormCompleted} />);

    const typeInput = screen.getByLabelText('Agent');
    const nameInput = screen.getByLabelText('Name');
    const descriptionInput = screen.getByLabelText('Description');

    expect(typeInput).toBeInTheDocument();
    expect(nameInput).toBeInTheDocument();
    expect(descriptionInput).toBeInTheDocument();
  });

  it('correctly sets initial values for the form fields', () => {
    render(<EditAgentForm agent={mockAgent} setFormCompleted={setFormCompleted} />);

    const typeInput = screen.getByLabelText('Agent');
    const nameInput = screen.getByLabelText('Name');
    const descriptionInput = screen.getByLabelText('Description');

    expect(typeInput).toHaveValue(AiAgentLabels[mockAgent.type]);
    expect(nameInput).toHaveValue(mockAgent.name);
    expect(descriptionInput).toHaveValue(mockAgent.description);
  });

  it('renders a cancel button', () => {
    render(<EditAgentForm agent={mockAgent} setFormCompleted={setFormCompleted} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    expect(cancelButton).toBeInTheDocument();
  });

  it('renders a submit button', () => {
    render(<EditAgentForm agent={mockAgent} setFormCompleted={setFormCompleted} />);

    const submitButton = screen.getByRole('button', { name: 'Update Agent' });
    expect(submitButton).toBeInTheDocument();
  });

  it('calls setFormCompleted when cancel button is clicked', () => {
    render(<EditAgentForm agent={mockAgent} setFormCompleted={setFormCompleted} />);

    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    cancelButton.click();

    expect(setFormCompleted).toHaveBeenCalledWith(true);
  });

  it('disables the submit button by default', () => {
    render(<EditAgentForm agent={mockAgent} setFormCompleted={setFormCompleted} />);

    const submitButton = screen.getByRole('button', { name: 'Update Agent' });
    expect(submitButton).toBeDisabled();
  });

  it('enables the submit button when form is valid and dirty', () => {
    render(<EditAgentForm agent={mockAgent} setFormCompleted={setFormCompleted} />);

    const nameInput = screen.getByLabelText('Name');

    fireEvent.change(nameInput, { target: { value: 'Updated Agent Name' } });

    const submitButton = screen.getByRole('button', { name: 'Update Agent' });
    expect(submitButton).toBeEnabled();
  });

  it('calls mutateAsync on form submission with updated values', async () => {
    render(<EditAgentForm agent={mockAgent} setFormCompleted={setFormCompleted} />);

    const nameInput = screen.getByLabelText('Name');
    const descriptionInput = screen.getByLabelText('Description');

    fireEvent.change(nameInput, { target: { value: 'Updated Agent Name' } });
    fireEvent.change(descriptionInput, { target: { value: 'Updated description' } });

    const submitButton = screen.getByRole('button', { name: 'Update Agent' });
    fireEvent.click(submitButton);

    expect(mutateAsync).toHaveBeenCalledWith({
      id: mockAgent.id,
      name: 'Updated Agent Name',
      description: 'Updated description',
      type: AiAgentType.CERTA,
    });
  });

  it('keeps submit button disabled when form is reset to original values', () => {
    render(<EditAgentForm agent={mockAgent} setFormCompleted={setFormCompleted} />);

    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Test Agent Updated' } });
    
    let submitButton = screen.getByRole('button', { name: 'Update Agent' });
    expect(submitButton).toBeEnabled();
    
    fireEvent.change(nameInput, { target: { value: 'Test Agent' } });
    
    submitButton = screen.getByRole('button', { name: 'Update Agent' });
    expect(submitButton).toBeDisabled();
    
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('calls setFormCompleted after successful submission', async () => {
    mutateAsync.mockResolvedValue({});
    
    render(<EditAgentForm agent={mockAgent} setFormCompleted={setFormCompleted} />);

    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Updated Agent Name' } });

    const submitButton = screen.getByRole('button', { name: 'Update Agent' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(setFormCompleted).toHaveBeenCalledWith(true);
    });
  });

  it('shows error notification on submission failure', async () => {
    const errorMessage = 'Error updating AI agent';
    mutateAsync.mockRejectedValue(new Error(errorMessage));

    render(<EditAgentForm agent={mockAgent} setFormCompleted={setFormCompleted} />);

    const nameInput = screen.getByLabelText('Name');
    fireEvent.change(nameInput, { target: { value: 'Updated Agent Name' } });

    const submitButton = screen.getByRole('button', { name: 'Update Agent' });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'edit-ai-agent-failed',
        title: 'Failed to Save Changes',
        message: 'Unable to save your changes. Please try again later.',
        icon: expect.any(Object),
        variant: 'failed_operation',
        autoClose: false,
      });
    });

    expect(setFormCompleted).not.toHaveBeenCalled();
  });
});
