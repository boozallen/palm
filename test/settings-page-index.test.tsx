import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSession } from 'next-auth/react';
import { useSettings } from '@/providers/SettingsProvider';
import SettingsPage from '@/pages/settings';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/settings/components/system-configurations/SystemConfigurations', () => {
  return function SystemConfigurations() {
    return <div data-testid='system-configurations-title'>System Configurations</div>;
  };
});

jest.mock('@/features/settings/components/ai-providers/AiProviders', () => {
  return function AiProviders() {
    return <div data-testid='ai-providers-title'>AI Providers</div>;
  };
});

jest.mock('@/features/settings/components/kb-providers/KbProviders', () => {
  return function KbProviders() {
    return <div data-testid='kb-providers-title'>Knowledge Base Providers</div>;
  };
});

jest.mock('@/features/settings/components/ai-agents/AiAgents', () => {
  return function AiAgents() {
    return <div data-testid='ai-agents-title'>AI Agents</div>;
  };
});

jest.mock('@/features/settings/components/document-upload/DocumentUploadProviders', () => {
  return function DocumentUploadProviders() {
    return <div data-testid='document-upload-providers-title'>Document Upload Providers</div>;
  };
});

jest.mock('@/features/settings/components/user-groups/UserGroups', () => {
  return function UserGroups() {
    return <div data-testid='user-groups-title'>User Groups</div>;
  };
});

jest.mock('@/features/settings/components/admins/Admins', () => {
  return function Admins() {
    return <div data-testid='admins-title'>Admins</div>;
  };
});

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/providers/SettingsProvider', () => ({
  useSettings: jest.fn(),
}));

jest.mock('@/features/settings/api/user-groups/get-user-groups-as-lead', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({ data: { userGroupsAsLead: [] } }),
}));

jest.mock('@/features/shared/api/create-client-side-audit-record', () => ({
  useCreateClientSideAuditRecord: jest.fn().mockReturnValue({ mutate: jest.fn() }),
}));

describe('SettingsPage', () => {

  beforeEach(() => {
    (useSettings as jest.Mock).mockImplementation(() => ({
      activeSettingsTab: 'general',
      setActiveSettingsTab: jest.fn(),
    }));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders settings page and all tabs if user is admin', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { role: UserRole.Admin } },
    });

    render(<SettingsPage />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Manage system settings and resources')).toBeInTheDocument();
    expect(screen.getByTestId('settings-system-tab')).toBeInTheDocument();
    expect(screen.getByTestId('settings-providers-tab')).toBeInTheDocument();
    expect(screen.getByTestId('settings-agents-services-tab')).toBeInTheDocument();
    expect(screen.getByTestId('settings-data-sources-tab')).toBeInTheDocument();
    expect(screen.getByTestId('settings-access-control-tab')).toBeInTheDocument();
  });

  it('renders system tab that is displayed by default for admins', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { role: UserRole.Admin } },
    });

    render(<SettingsPage />);

    const systemTab = screen.getByTestId('settings-system-tab');
    expect(systemTab).toBeInTheDocument();
    expect(screen.getByTestId('system-configurations-title')).toBeInTheDocument();
  });

  it('displays correct tab content when a tab is selected', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { role: UserRole.Admin } },
    });

    const { getByTestId } = render(<SettingsPage />);

    // System tab is selected by default
    expect(screen.getByTestId('system-configurations-title')).toBeInTheDocument();

    // Click providers top-level tab, then sidebar items
    fireEvent.click(getByTestId('settings-providers-tab'));
    fireEvent.click(getByTestId('sidebar-ai-providers'));
    expect(screen.getByTestId('ai-providers-title')).toBeInTheDocument();

    fireEvent.click(getByTestId('sidebar-kb-providers'));
    expect(screen.getByTestId('kb-providers-title')).toBeInTheDocument();

    fireEvent.click(getByTestId('sidebar-document-upload-providers'));
    expect(screen.getByTestId('document-upload-providers-title')).toBeInTheDocument();

    // Click agents-services top-level tab, then sidebar items
    fireEvent.click(getByTestId('settings-agents-services-tab'));
    fireEvent.click(getByTestId('sidebar-ai-agents'));
    expect(screen.getByTestId('ai-agents-title')).toBeInTheDocument();

    // Click access-control top-level tab, then sidebar items
    fireEvent.click(getByTestId('settings-access-control-tab'));
    fireEvent.click(getByTestId('sidebar-user-groups'));
    expect(screen.getByTestId('user-groups-title')).toBeInTheDocument();

    fireEvent.click(getByTestId('sidebar-admins'));
    expect(screen.getByTestId('admins-title')).toBeInTheDocument();
  });

  it('does not render admin-only tabs for non-admins', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { role: UserRole.User } },
    });

    render(<SettingsPage />);

    expect(screen.queryByTestId('settings-system-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-providers-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-agents-services-tab')).not.toBeInTheDocument();
    expect(screen.getByTestId('settings-access-control-tab')).toBeInTheDocument();

    // Non-admin should not see admins sidebar item
    expect(screen.queryByTestId('sidebar-admins')).not.toBeInTheDocument();
  });

  it('displays admins sidebar item if user is admin', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { role: UserRole.Admin } },
    });

    render(<SettingsPage />);

    // Click access-control tab to show sidebar
    fireEvent.click(screen.getByTestId('settings-access-control-tab'));

    expect(screen.getByTestId('sidebar-admins')).toBeInTheDocument();
  });
});
