import { render, screen, fireEvent } from '@testing-library/react';

import RegenerateResponseModal, { suppressRegenerateResponseWarningCookie } from './RegenerateResponseModal';
import useRegenerateResponse from '@/features/chat/hooks/useRegenerateResponse';

jest.mock('@/features/chat/hooks/useRegenerateResponse');

describe('RegenerateResponseModal', () => {
  const mutateAsync = jest.fn();
  const closeModalHandler = jest.fn();
  const messageId = 'test-message-id';

  beforeEach(() => {
    jest.clearAllMocks();

    (useRegenerateResponse as jest.Mock).mockReturnValue({
        mutateAsync,
    });
  });

  it('renders the modal if opened', () => {
    const modalOpened = true;

    render(
      <RegenerateResponseModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        messageId={messageId}
      />
    );

    expect(screen.getByText('Regenerate Response')).toBeInTheDocument();
    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Continue')).toBeInTheDocument();
  });

  it('calls the closeModalHandler when cancel button is clicked', () => {
    const modalOpened = true;

    render(
      <RegenerateResponseModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        messageId={messageId}
      />
    );

    fireEvent.click(screen.getByText('Cancel'));

    expect(closeModalHandler).toHaveBeenCalledTimes(1);
  });

  it('calls the regenerate response hook when continue button is clicked', () => {
    const modalOpened = true;
    const closeModalHandler = jest.fn();

    render(
      <RegenerateResponseModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        messageId={messageId}
      />
    );

    fireEvent.click(screen.getByText('Continue'));

    expect(mutateAsync).toHaveBeenCalled();
  });

  it('renders checkbox', () => {
    const modalOpened = true;

    render(
      <RegenerateResponseModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        messageId={messageId}
      />
    );

    const checkbox = screen.getByLabelText('Do not show this message again');

    expect(checkbox).toBeInTheDocument();
  });

  it('updates localStorage with value of checkbox', () => {
    const modalOpened = true;

    Storage.prototype.setItem = jest.fn();

    render(
      <RegenerateResponseModal
        modalOpened={modalOpened}
        closeModalHandler={closeModalHandler}
        messageId={messageId}
      />
    );

    const checkbox = screen.getByLabelText('Do not show this message again');
    fireEvent.click(checkbox);

    expect(localStorage.setItem).toHaveBeenCalledWith(
      suppressRegenerateResponseWarningCookie,
      'true'
    );

    fireEvent.click(checkbox);
    expect(localStorage.setItem).toHaveBeenCalledWith(
      suppressRegenerateResponseWarningCookie,
      'true'
    );
  });
});
