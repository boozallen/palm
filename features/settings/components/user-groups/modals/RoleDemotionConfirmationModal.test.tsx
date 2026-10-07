import RoleDemotionConfirmationModal from './RoleDemotionConfirmationModal';
import { render, screen, fireEvent } from '@testing-library/react';

jest.mock('@mantine/notifications');

type RoleDemotionConfirmationModalProps = Readonly<{
  modalOpened: boolean;
  closeModalHandler: () => void;
  onConfirm: () => void;
}>;

const renderModal = (props: RoleDemotionConfirmationModalProps) => {
  render(
    <RoleDemotionConfirmationModal
      modalOpened={props.modalOpened}
      closeModalHandler={props.closeModalHandler}
      onConfirm={props.onConfirm}
    />
  );
};

describe('RoleDemotionConfirmationModal', () => {
  const closeModalHandler = jest.fn();
  const handleConfirm = jest.fn();

  let modalOpened: boolean;

  beforeEach(() => {
    jest.clearAllMocks();

    modalOpened = true;
  });

  it('renders the modal with the correct props', () => {
    renderModal({
      modalOpened: modalOpened,
      closeModalHandler: closeModalHandler,
      onConfirm: handleConfirm,
    });

    expect(
      screen.getByTestId('role-demotion-confirmation-modal')
    ).toBeInTheDocument();
    expect(screen.getByText('Confirm Role Change')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Confirm Change')).toBeInTheDocument();
  });

  it('does not render modal if modalOpened is false', () => {
    modalOpened = false;
    renderModal({
      modalOpened: modalOpened,
      closeModalHandler: closeModalHandler,
      onConfirm: handleConfirm,
    });

    expect(screen.queryByText('Confirm Role Change')).not.toBeInTheDocument();
    expect(screen.queryByText('Cancel')).not.toBeInTheDocument();
    expect(screen.queryByText('Confirm Change')).not.toBeInTheDocument();
  });

  it('calls the closeModalHandler when cancel button is clicked', () => {
    renderModal({
      modalOpened: modalOpened,
      closeModalHandler: closeModalHandler,
      onConfirm: handleConfirm,
    });

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });
});
