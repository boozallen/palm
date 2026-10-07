import { render } from '@testing-library/react';

import AddKbProviderModal from './AddKbProviderModal';

jest.mock('@/features/settings/components/kb-providers/forms/AddKbProviderForm', () => {
  return function MockAddKbProviderForm() {
    return <div>Mock Add Kb Provider Form</div>;
  };
});

describe('AddKbProviderModal', () => {

  const renderModal = (modalOpen: boolean) => {
    return render(
      <AddKbProviderModal
        modalOpen={modalOpen}
        closeModalHandler={jest.fn()}
      />
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('successfully renders', () => {
    const { container, getByTestId } = renderModal(true);

    expect(container).toBeTruthy();
    expect(getByTestId('add-kb-provider-modal')).toBeInTheDocument();
  });

  it('displays modal with form when modalOpen is true', () => {
    const { getByText } = renderModal(true);

    expect(getByText('Add KB Provider')).toBeInTheDocument();
    expect(getByText('Mock Add Kb Provider Form')).toBeInTheDocument();
  });

  it('hides modal with form when modalOpen is false', () => {
    const { queryByText } = renderModal(false);

    expect(queryByText('Mock Add Kb Provider Form')).not.toBeInTheDocument();
  });

});
