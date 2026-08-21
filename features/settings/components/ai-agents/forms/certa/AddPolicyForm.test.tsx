import { notifications } from '@mantine/notifications';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import useCreateCertaPolicy from '@/features/settings/api/ai-agents/certa/create-certa-policy';
import useGetPolicyRequirements from '@/features/settings/api/ai-agents/certa/get-policy-requirements';
import AddPolicyForm from './AddPolicyForm';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/ai-agents/certa/create-certa-policy');
jest.mock('@/features/settings/api/ai-agents/certa/get-policy-requirements');

const mockAgentId = '62d68df7-424e-439e-b582-880340220fe6';
const closeForm = jest.fn();
const renderComponent = () => {
  return render(
    <AddPolicyForm aiAgentId={mockAgentId} closeForm={closeForm} />
  );
};

const getFormFields = () => {
  return {
    title: screen.getByLabelText('Title'),
    content: screen.getByLabelText('Content'),
    requirements: screen.getByLabelText('Requirements'),
  };
};

const submitForm = async () => {
  const submitButton = screen.getByRole('button', { name: 'Add Policy' });
  await act(async () => {
    fireEvent.click(submitButton);
  });
};

const createCertaPolicy = jest.fn();
const generateRequirements = jest.fn();

const mockUseCreateCertaPolicy = (isPending = false) => {
  (useCreateCertaPolicy as jest.Mock).mockReturnValue({
    mutateAsync: createCertaPolicy,
    isPending,
  });
};

const mockUseGetPolicyRequirements = (isPending = false) => {
  (useGetPolicyRequirements as jest.Mock).mockReturnValue({
    mutateAsync: generateRequirements,
    isPending,
  });
};

describe('PolicyForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCreateCertaPolicy();
    mockUseGetPolicyRequirements();
  });

  describe('Form initialization', () => {
    it('renders form fields', () => {
      renderComponent();

      const { title, content, requirements } = getFormFields();

      expect(title).toBeInTheDocument();
      expect(content).toBeInTheDocument();
      expect(requirements).toBeInTheDocument();
    });

    it('initializes form with empty values', () => {
      renderComponent();

      const { title, content, requirements } = getFormFields();

      expect(title).toHaveValue('');
      expect(content).toHaveValue('');
      expect(requirements).toHaveValue('');
    });
  });

  describe('Form updates', () => {
    it('updates title field', () => {
      renderComponent();

      const { title } = getFormFields();

      fireEvent.change(title, { target: { value: 'New Title' } });

      expect(title).toHaveValue('New Title');
    });

    it('updates content field', () => {
      renderComponent();

      const { content } = getFormFields();

      fireEvent.change(content, { target: { value: 'New Content' } });

      expect(content).toHaveValue('New Content');
    });

    it('updates requirements field', () => {
      renderComponent();

      const { requirements } = getFormFields();

      fireEvent.change(requirements, { target: { value: 'New Requirements' } });

      expect(requirements).toHaveValue('New Requirements');
    });

    it('generates requirements when button is clicked', async () => {
      generateRequirements.mockResolvedValue({
        requirements: 'Generated Requirements',
      });
      renderComponent();

      const { content } = getFormFields();
      fireEvent.change(content, { target: { value: 'Policy Content' } });

      const generateButton = screen.getByTestId('generate-requirements-icon');
      await act(async () => {
        fireEvent.click(generateButton);
      });

      const { requirements } = getFormFields();
      expect(generateRequirements).toHaveBeenCalledWith({
        policyContent: 'Policy Content',
      });
      expect(requirements).toHaveValue('Generated Requirements');
    });

    it('does not call generate requirements if content is empty', async () => {
      renderComponent();

      const generateButton = screen.getByTestId('generate-requirements-icon');
      await act(async () => {
        fireEvent.click(generateButton);
      });

      expect(generateRequirements).not.toHaveBeenCalled();
    });

    it('shows notification on requirements generation failure', async () => {
      generateRequirements.mockRejectedValue(new Error('Generation failed'));
      renderComponent();

      const { content } = getFormFields();
      fireEvent.change(content, { target: { value: 'Policy Content' } });

      const generateButton = screen.getByTestId('generate-requirements-icon');
      await act(async () => {
        fireEvent.click(generateButton);
      });

      expect(notifications.show).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Requirements Generation Error',
          color: 'red',
        })
      );
    });
  });

  describe('Form validation', () => {
    it('marks title as invalid if its empty', async () => {
      renderComponent();

      const { title } = getFormFields();

      await submitForm();

      expect(title).toHaveAttribute('aria-invalid', 'true');
    });

    it('marks content as invalid if its empty', async () => {
      renderComponent();

      const { content } = getFormFields();

      await submitForm();

      expect(content).toHaveAttribute('aria-invalid', 'true');
    });

    it('marks requirements as invalid if its empty', async () => {
      renderComponent();

      const { requirements } = getFormFields();

      await submitForm();

      expect(requirements).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Form submission', () => {
    it('submits form with correct values', async () => {
      renderComponent();

      const { title, content, requirements } = getFormFields();
      fireEvent.change(title, { target: { value: 'Policy Title' } });
      fireEvent.change(content, { target: { value: 'Policy Content' } });
      fireEvent.change(requirements, {
        target: { value: 'Policy Requirements' },
      });

      await submitForm();

      expect(createCertaPolicy).toHaveBeenCalledWith({
        aiAgentId: mockAgentId,
        title: 'Policy Title',
        content: 'Policy Content',
        requirements: 'Policy Requirements',
      });
    });

    it('calls closeForm on successful submission', async () => {
      renderComponent();
      const { title, content, requirements } = getFormFields();
      fireEvent.change(title, { target: { value: 'Policy Title' } });
      fireEvent.change(content, { target: { value: 'Policy Content' } });
      fireEvent.change(requirements, {
        target: { value: 'Policy Requirements' },
      });

      await submitForm();

      expect(closeForm).toHaveBeenCalledWith(true);
    });

    it('does not submit form if any field is invalid', async () => {
      renderComponent();

      await submitForm();

      expect(createCertaPolicy).not.toHaveBeenCalled();
    });

    it('changes button text while submitting', () => {
      mockUseCreateCertaPolicy(true);

      renderComponent();

      expect(screen.getByText('Adding Policy')).toBeInTheDocument();
    });

    it('changes button state while submitting', () => {
      mockUseCreateCertaPolicy(true);

      renderComponent();

      expect(
        screen.getByRole('button', { name: 'Adding Policy' })
      ).toHaveAttribute('data-loading', 'true');
    });

    it('displays error notification on submission failure', async () => {
      mockUseCreateCertaPolicy(false);
      createCertaPolicy.mockRejectedValue(new Error('Submission failed'));

      renderComponent();

      const { title, content, requirements } = getFormFields();

      fireEvent.change(title, { target: { value: 'Policy Title' } });
      fireEvent.change(content, { target: { value: 'Policy Content' } });
      fireEvent.change(requirements, {
        target: { value: 'Policy Requirements' },
      });

      await submitForm();

      waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith(
          expect.objectContaining({
            variant: 'failed_operation',
          })
        );
      });
    });
  });
});
