import { notifications } from '@mantine/notifications';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import useUpdateCertaPolicy from '@/features/settings/api/ai-agents/certa/update-certa-policy';
import EditPolicyForm from './EditPolicyForm';
import { PolicyForm } from '@/features/settings/types';
import useGetPolicyRequirements from '@/features/settings/api/ai-agents/certa/get-policy-requirements';

jest.mock('@mantine/notifications');
jest.mock('@/features/settings/api/ai-agents/certa/update-certa-policy');
jest.mock('@/features/settings/api/ai-agents/certa/get-policy-requirements');

const mockPolicyId = '62d68df7-424e-439e-b582-880340220fe6';
const mockInitialValues: PolicyForm = {
  title: 'Initial Title',
  content: 'Initial Content',
  requirements: 'Initial Requirements',
};
const closeForm = jest.fn();

const renderComponent = (initialValues: PolicyForm = mockInitialValues) => {
  return render(
    <EditPolicyForm
      policyId={mockPolicyId}
      initialValues={initialValues}
      closeForm={closeForm}
    />
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
  const submitButton = screen.getByRole('button', { name: 'Save Changes' });
  await act(async () => {
    fireEvent.click(submitButton);
  });
};

const updateCertaPolicy = jest.fn();
const mockUseUpdateCertaPolicy = (isPending = false) => {
  (useUpdateCertaPolicy as jest.Mock).mockReturnValue({
    mutateAsync: updateCertaPolicy,
    isPending,
  });
};

const generateRequirements = jest.fn();
const mockUseGetPolicyRequirements = (isPending = false) => {
  (useGetPolicyRequirements as jest.Mock).mockReturnValue({
    mutateAsync: generateRequirements,
    isPending,
  });
};

describe('EditPolicyForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUpdateCertaPolicy();
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

    it('initializes form with provided values', () => {
      renderComponent();

      const { title, content, requirements } = getFormFields();

      expect(title).toHaveValue('Initial Title');
      expect(content).toHaveValue('Initial Content');
      expect(requirements).toHaveValue('Initial Requirements');
    });
  });

  describe('Form updates', () => {
    it('updates title field', () => {
      renderComponent();

      const { title } = getFormFields();

      fireEvent.change(title, { target: { value: 'Updated Title' } });

      expect(title).toHaveValue('Updated Title');
    });

    it('updates content field', () => {
      renderComponent();

      const { content } = getFormFields();

      fireEvent.change(content, { target: { value: 'Updated Content' } });

      expect(content).toHaveValue('Updated Content');
    });

    it('updates requirements field', () => {
      renderComponent();

      const { requirements } = getFormFields();

      fireEvent.change(requirements, {
        target: { value: 'Updated Requirements' },
      });

      expect(requirements).toHaveValue('Updated Requirements');
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

      const { content } = getFormFields();
      fireEvent.change(content, { target: { value: '' } });
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
      renderComponent({
        title: '',
        content: 'Content',
        requirements: 'Requirements',
      });

      const { title } = getFormFields();

      await submitForm();

      expect(title).toHaveAttribute('aria-invalid', 'true');
    });

    it('marks content as invalid if its empty', async () => {
      renderComponent({
        title: 'Title',
        content: '',
        requirements: 'Requirements',
      });

      const { content } = getFormFields();

      await submitForm();

      expect(content).toHaveAttribute('aria-invalid', 'true');
    });

    it('marks requirements as invalid if its empty', async () => {
      renderComponent({
        title: 'Title',
        content: 'Content',
        requirements: '',
      });

      const { requirements } = getFormFields();

      await submitForm();

      expect(requirements).toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Form submission', () => {
    it('submits form with correct values', async () => {
      renderComponent();

      const { title, content, requirements } = getFormFields();
      fireEvent.change(title, { target: { value: 'Updated Title' } });
      fireEvent.change(content, { target: { value: 'Updated Content' } });
      fireEvent.change(requirements, {
        target: { value: 'Updated Requirements' },
      });

      await submitForm();

      expect(updateCertaPolicy).toHaveBeenCalledWith({
        id: mockPolicyId,
        title: 'Updated Title',
        content: 'Updated Content',
        requirements: 'Updated Requirements',
      });
    });

    it('calls closeForm on successful submission', async () => {
      renderComponent();
      const { title, content, requirements } = getFormFields();
      fireEvent.change(title, { target: { value: 'Updated Title' } });
      fireEvent.change(content, { target: { value: 'Updated Content' } });
      fireEvent.change(requirements, {
        target: { value: 'Updated Requirements' },
      });

      await submitForm();

      expect(closeForm).toHaveBeenCalledWith(true);
    });

    it('does not submit form if any field is invalid', async () => {
      renderComponent({
        title: '',
        content: 'Content',
        requirements: 'Requirements',
      });

      await submitForm();

      expect(updateCertaPolicy).not.toHaveBeenCalled();
    });

    it('changes button text while submitting', () => {
      mockUseUpdateCertaPolicy(true);

      renderComponent();

      expect(screen.getByText('Saving Changes')).toBeInTheDocument();
    });

    it('changes button state while submitting', () => {
      mockUseUpdateCertaPolicy(true);

      renderComponent();

      expect(
        screen.getByRole('button', { name: 'Saving Changes' })
      ).toHaveAttribute('data-loading', 'true');
    });

    it('displays error notification on submission failure', async () => {
      mockUseUpdateCertaPolicy(false);
      updateCertaPolicy.mockRejectedValue(new Error('Submission failed'));

      renderComponent();

      const { title, content, requirements } = getFormFields();
      act(() => {
        fireEvent.change(title, { target: { value: 'Updated Title' } });
        fireEvent.change(content, { target: { value: 'Updated Content' } });
        fireEvent.change(requirements, {
          target: { value: 'Updated Requirements' },
        });
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

  describe('Form cancellation', () => {
    it('calls closeForm when cancel button is clicked', () => {
      renderComponent();

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(closeForm).toHaveBeenCalledWith(true);
    });
  });
});
