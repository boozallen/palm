import { fireEvent, render, screen } from '@testing-library/react';
import JoinUserGroupDialog from './JoinUserGroupDialog';
import { useCreateClientSideAuditRecord } from '@/features/shared/api/create-client-side-audit-record';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetWorkspaceStats from '@/features/shared/api/get-workspace-stats';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

jest.mock('@/features/profile/components/forms/JoinUserGroupForm', () => {
  return jest.fn(() => <div data-testid='join-user-group-form' />);
});
jest.mock('@/features/shared/api/get-workspace-stats', () => ({
  __esModule: true,
  default: jest.fn(() => ({ data: undefined })),
}));
jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/create-client-side-audit-record');

describe('JoinUserGroupDialog', () => {
  const onCollapse = jest.fn();
  const onExpand = jest.fn();
  const createAuditRecord = jest.fn();

  const renderDialog = (collapsed: boolean) =>
    render(
      <JoinUserGroupDialog
        opened={true}
        collapsed={collapsed}
        focusRequestId={0}
        onCollapse={onCollapse}
        onExpand={onExpand}
      />
    );

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { joinUserGroupDialogExternalLink: 'https://example.com/get-access' },
    });
    (useCreateClientSideAuditRecord as jest.Mock).mockReturnValue({ mutate: createAuditRecord });
  });

  it('renders the expanded content with the form', () => {
    renderDialog(false);

    expect(screen.getByTestId('join-user-group-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('join-user-group-dialog-title')).toBeInTheDocument();
    expect(screen.getByTestId('join-user-group-form')).toBeInTheDocument();
  });

  it('renders the get access link from the system config', () => {
    renderDialog(false);

    expect(screen.getByTestId('join-user-group-dialog-get-access-link')).toHaveAttribute(
      'href',
      'https://example.com/get-access'
    );
  });

  it('records a request access audit record when the get access link is clicked', () => {
    renderDialog(false);

    fireEvent.click(screen.getByTestId('join-user-group-dialog-get-access-link'));

    expect(createAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.RequestAccessToPalm,
      label: 'Join User Group Dialog',
      href: 'https://example.com/get-access',
    });
  });

  it('also records an external navigation when the get access link is clicked', () => {
    renderDialog(false);

    fireEvent.click(screen.getByTestId('join-user-group-dialog-get-access-link'));

    expect(createAuditRecord).toHaveBeenCalledWith({
      event: AuditRecordEvent.ExternalNavigation,
      label: 'see how to get access',
      href: 'https://example.com/get-access',
    });
  });

  it('records the two events separately for a single get access click', () => {
    renderDialog(false);

    fireEvent.click(screen.getByTestId('join-user-group-dialog-get-access-link'));

    expect(createAuditRecord).toHaveBeenCalledTimes(2);
  });

  it('hides the get access link when the system config link is blank', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { joinUserGroupDialogExternalLink: '' },
    });

    renderDialog(false);

    expect(screen.queryByTestId('join-user-group-dialog-help')).not.toBeInTheDocument();
  });

  it('collapses when the collapse button is clicked', () => {
    renderDialog(false);

    fireEvent.click(screen.getByTestId('join-user-group-dialog-collapse'));

    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it('renders the collapsed pill without the form', () => {
    renderDialog(true);

    expect(screen.getByTestId('join-user-group-dialog-collapsed-label')).toBeInTheDocument();
    expect(screen.queryByTestId('join-user-group-form')).not.toBeInTheDocument();
  });

  it('expands when the collapsed pill is clicked', () => {
    renderDialog(true);

    fireEvent.click(screen.getByTestId('join-user-group-dialog-expand'));

    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it('shows the benefits and 30-day activity when stats are available', () => {
    (useGetWorkspaceStats as jest.Mock).mockReturnValue({
      data: {
        chatsLast30Days: 15,
        documentsUploadedLast30Days: 8,
        artifactsGeneratedLast30Days: 6,
        citationsGeneratedLast30Days: 24,
      },
    });

    renderDialog(false);

    expect(screen.getByTestId('join-user-group-dialog-benefit-prompts')).toHaveTextContent(
      'Access to reusable prompts, agents, and skills'
    );
    expect(screen.getByTestId('join-user-group-dialog-activity')).toBeInTheDocument();

    const chats = screen.getByTestId('join-user-group-dialog-activity-chats');
    expect(chats).toHaveTextContent('15');
    expect(chats).toHaveTextContent('chat conversations');

    const documents = screen.getByTestId('join-user-group-dialog-activity-documents');
    expect(documents).toHaveTextContent('8');
    expect(documents).toHaveTextContent('documents uploaded');

    const artifacts = screen.getByTestId('join-user-group-dialog-activity-artifacts');
    expect(artifacts).toHaveTextContent('6');
    expect(artifacts).toHaveTextContent('artifacts generated');

    const citations = screen.getByTestId('join-user-group-dialog-activity-citations');
    expect(citations).toHaveTextContent('24');
    expect(citations).toHaveTextContent('citations generated');
  });

  it('shows all four activity metrics even when some are zero', () => {
    (useGetWorkspaceStats as jest.Mock).mockReturnValue({
      data: {
        chatsLast30Days: 1,
        documentsUploadedLast30Days: 0,
        artifactsGeneratedLast30Days: 0,
        citationsGeneratedLast30Days: 0,
      },
    });

    renderDialog(false);

    expect(screen.getByTestId('join-user-group-dialog-activity')).toBeInTheDocument();
    expect(screen.getByTestId('join-user-group-dialog-activity-chats')).toBeInTheDocument();
    expect(screen.getByTestId('join-user-group-dialog-activity-documents')).toBeInTheDocument();
    expect(screen.getByTestId('join-user-group-dialog-activity-artifacts')).toBeInTheDocument();
    expect(screen.getByTestId('join-user-group-dialog-activity-citations')).toBeInTheDocument();
  });

  it('hides the activity section when stats have not loaded', () => {
    (useGetWorkspaceStats as jest.Mock).mockReturnValue({ data: undefined });

    renderDialog(false);

    expect(screen.queryByTestId('join-user-group-dialog-activity')).not.toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(
      <JoinUserGroupDialog
        opened={false}
        collapsed={false}
        focusRequestId={0}
        onCollapse={onCollapse}
        onExpand={onExpand}
      />
    );

    expect(screen.queryByTestId('join-user-group-dialog')).not.toBeInTheDocument();
  });
});
