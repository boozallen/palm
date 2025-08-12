import { render } from '@testing-library/react';

import AddAgentModal from './AddAgentModal';

jest.mock('@/features/settings/components/ai-agents/forms/AddAgentForm', () => {
  return jest.fn(() => <div>Add Agent Form</div>);
});

describe('AddAgentModal', () => {
  it('renders the modal if it is open', () => {
    const { getByText } = render(
      <AddAgentModal modalOpen={true} closeModalHandler={() => {}} />
    );

    expect(getByText('Add AI Agent')).toBeInTheDocument();
  });

  it('renders the form if modal is open', () => {
    const { getByText } = render(
      <AddAgentModal modalOpen={true} closeModalHandler={() => {}} />
    );

    expect(getByText('Add Agent Form')).toBeInTheDocument();
  });

  it('does not render modal or form if modal is closed', () => {
    const { queryByText } = render(
      <AddAgentModal modalOpen={false} closeModalHandler={() => {}} />
    );

    expect(queryByText('Add AI Agent')).not.toBeInTheDocument();
    expect(queryByText('Add Agent Form')).not.toBeInTheDocument();
  });
});
