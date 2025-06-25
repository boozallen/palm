import { render, screen } from '@testing-library/react';
import AddPolicyModal from './AddPolicyModal';

jest.mock('@/features/settings/components/ai-agents/forms/AddPolicyForm', () => {
  return function MockAddPolicyForm() {
    return <div>Mock Add Policy Form</div>;
  };
});

const mockAgentId = '6160e4f0-0f78-4c1c-af3f-2fb1b083f4bd';
const renderComponent = ({ isOpened }: { isOpened: boolean }) => {
  return render(
    <AddPolicyModal
      isOpened={isOpened}
      closeModal={jest.fn()}
      aiAgentId={mockAgentId}
    />
  );
};

describe('AddPolicyModal', () => {

  beforeEach(jest.clearAllMocks);

  describe('isOpened', () => {
    it('renders the modal', () => {
      renderComponent({ isOpened: true });

      expect(screen.getByText('Add Policy')).toBeInTheDocument();
    });

    it('renders the form', () => {
      renderComponent({ isOpened: true });

      expect(screen.getByText('Mock Add Policy Form')).toBeInTheDocument();
    });
  });

  describe('Not isOpened', () => {
    it('does not render the modal', () => {
      renderComponent({ isOpened: false });
      expect(screen.queryByText('Add Policy')).not.toBeInTheDocument();
    });
  });
});
