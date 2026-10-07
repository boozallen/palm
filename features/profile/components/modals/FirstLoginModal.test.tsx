import { fireEvent, render, screen } from '@testing-library/react';
import FirstLoginModal from './FirstLoginModal';
import { useCreateClientSideAuditRecord } from '@/features/shared/api/create-client-side-audit-record';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/create-client-side-audit-record');
jest.mock('@/features/shared/components/Loading', () => {
  return function MockLoading() {
    return <div>Loading...</div>;
  };
});
jest.mock('@/features/profile/components/forms/JoinUserGroupForm', () => {
  return jest.fn(() => <div>Join User Group Form</div>);
});

describe('FirstLoginModal', () => {
  const closeModalHandler = jest.fn();
  const createAuditRecord = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { joinUserGroupDialogExternalLink: 'https://example.com/get-access' },
    });
    (useCreateClientSideAuditRecord as jest.Mock).mockReturnValue({ mutate: createAuditRecord });
  });
;
  it('should render the modal with content', () => {
    render(<FirstLoginModal modalOpened={true} closeModalHandler={closeModalHandler} />);

    expect(screen.getByTestId('first-login-modal')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Prompt & Agent Library Marketplace (PALM)')).toBeInTheDocument();

    expect(screen.getByText('Join User Group Form')).toBeInTheDocument();
  });

  it('should render the get access link from the system config', () => {
    render(<FirstLoginModal modalOpened={true} closeModalHandler={closeModalHandler} />);

    expect(screen.getByTestId('first-login-modal-get-access-link')).toHaveAttribute(
      'href',
      'https://example.com/get-access'
    );
  });

  it('should render the AI Risk Trigger sentence when the system config link is set', () => {
    render(<FirstLoginModal modalOpened={true} closeModalHandler={closeModalHandler} />);

    expect(screen.getByTestId('first-login-modal-ai-risk-trigger')).toHaveTextContent(
      'If not, you will need an approved AI Risk Trigger request before we can add you to a user group'
    );
  });

  it('should record a request access audit record when the get access link is clicked', () => {
    render(<FirstLoginModal modalOpened={true} closeModalHandler={closeModalHandler} />);

    fireEvent.click(screen.getByTestId('first-login-modal-get-access-link'));

    expect(createAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.RequestAccessToPalm,
      label: 'First Login Modal',
      href: 'https://example.com/get-access',
    });
  });

  it('should also record an external navigation when the get access link is clicked', () => {
    render(<FirstLoginModal modalOpened={true} closeModalHandler={closeModalHandler} />);

    fireEvent.click(screen.getByTestId('first-login-modal-get-access-link'));

    expect(createAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.ExternalNavigation,
      label: 'see how to get access on the PALM site',
      href: 'https://example.com/get-access',
    });
  });

  it('should record the two events separately for a single get access click', () => {
    render(<FirstLoginModal modalOpened={true} closeModalHandler={closeModalHandler} />);

    fireEvent.click(screen.getByTestId('first-login-modal-get-access-link'));

    expect(createAuditRecord).toHaveBeenCalledTimes(2);
  });

  it('should not render the get access link or AI Risk Trigger sentence when the system config link is blank', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { joinUserGroupDialogExternalLink: '' },
    });

    render(<FirstLoginModal modalOpened={true} closeModalHandler={closeModalHandler} />);

    expect(screen.queryByTestId('first-login-modal-get-access-link')).not.toBeInTheDocument();
    expect(screen.queryByTestId('first-login-modal-ai-risk-trigger')).not.toBeInTheDocument();
  });
});
