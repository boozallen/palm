import { render, screen } from '@testing-library/react';
import EditPolicyModal from './EditPolicyModal';

jest.mock(
  '@/features/settings/components/ai-agents/forms/certa/EditPolicyForm',
  () => {
    return function MockEditPolicyForm() {
      return <div>Mock Edit Policy Form</div>;
    };
  }
);

const mockPolicyId = '6160e4f0-0f78-4c1c-af3f-2fb1b083f4bd';
const mockInitialValues = {
  title: 'Initial Title',
  content: 'Initial Content',
  requirements: 'Initial Requirements',
};

const renderComponent = ({ isOpened }: { isOpened: boolean }) => {
  return render(
    <EditPolicyModal
      isOpened={isOpened}
      closeModal={jest.fn()}
      policyId={mockPolicyId}
      initialValues={mockInitialValues}
    />
  );
};

describe('EditPolicyModal', () => {
  beforeEach(jest.clearAllMocks);

  describe('isOpened', () => {
    it('renders the modal', () => {
      renderComponent({ isOpened: true });

      expect(screen.getByText('Edit Policy')).toBeInTheDocument();
    });

    it('renders the form', () => {
      renderComponent({ isOpened: true });

      expect(screen.getByText('Mock Edit Policy Form')).toBeInTheDocument();
    });
  });

  describe('Not isOpened', () => {
    it('does not render the modal', () => {
      renderComponent({ isOpened: false });
      expect(screen.queryByText('Edit Policy')).not.toBeInTheDocument();
    });
  });
});
