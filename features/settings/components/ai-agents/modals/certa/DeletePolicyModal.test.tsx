import { render, screen, fireEvent } from '@testing-library/react';
import DeletePolicyModal from './DeletePolicyModal';
import useDeleteCertaPolicy from '@/features/settings/api/ai-agents/certa/delete-certa-policy';

jest.mock('@/features/settings/api/ai-agents/certa/delete-certa-policy');

describe('DeletePolicyModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  const deleteCertaPolicyMock = jest.fn();
  (useDeleteCertaPolicy as jest.Mock).mockReturnValue({
    mutateAsync: deleteCertaPolicyMock,
    error: undefined,
  });
  it('renders the modal with the correct props', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const policyId = '123';

    render(
      <DeletePolicyModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        policyId={policyId}
      />
    );

    expect(screen.getByText('Delete CERTA Policy')).toBeInTheDocument();
    expect(
      screen.getByText('Are you sure you want to delete this policy?')
    ).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Delete Policy')).toBeInTheDocument();
  });

  it('calls the closeModalHandler when cancel button is clicked', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const policyId = '123';

    render(
      <DeletePolicyModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        policyId={policyId}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls the delete API when delete button is clicked', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();
    const policyId = '123';

    render(
      <DeletePolicyModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        policyId={policyId}
      />
    );

    fireEvent.click(screen.getByText('Delete Policy'));

    expect(deleteCertaPolicyMock).toHaveBeenCalledTimes(1);
  });
});
