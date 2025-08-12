import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useSession } from 'next-auth/react';
import { useSettings } from '@/providers/SettingsProvider';
import SettingsPage from '@/pages/settings';
import { UserRole } from '@/features/shared/types/user';

jest.mock('@/features/settings/components/system-configurations/SystemConfigurations', () => {
  return function SystemConfigurations() {
    return <div>System Configurations</div>;
  };
});

jest.mock('@/features/settings/components/kb-providers/KbProviders', () => {
  return function KbProviders() {
    return <div>KB Providers Component</div>;
  };
});

jest.mock('@/features/settings/components/ai-agents/AiAgents', () => {
  return function AiAgents() {
    return <div>Ai Agents Component</div>;
  };
});

jest.mock('@/features/settings/components/document-upload/DocumentUploadProviders', () => {
  return jest.fn(() => <div>Document Upload Providers Component</div>);
});

jest.mock('next-auth/react', () => ({
  useSession: jest.fn(),
}));

jest.mock('@/providers/SettingsProvider', () => ({
  useSettings: jest.fn(),
}));

let setActiveSettingsTab: jest.Mock;

describe('SettingsPage', () => {

  beforeEach(() => {
    setActiveSettingsTab = jest.fn();

    (useSettings as jest.Mock).mockImplementation(() => ({
      activeSettingsTab: 'general',
      setActiveSettingsTab: setActiveSettingsTab,
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
    expect(screen.getByTestId('settings-general-tab')).toBeInTheDocument();
    expect(screen.getByTestId('settings-ai-providers-tab')).toBeInTheDocument();
    expect(screen.getByTestId('settings-kb-providers-tab')).toBeInTheDocument();
    expect(screen.getByTestId('settings-user-groups-tab')).toBeInTheDocument();
    expect(screen.getByTestId('settings-ai-agents-tab')).toBeInTheDocument();
    expect(screen.getByTestId('settings-document-upload-providers-tab')).toBeInTheDocument();
  });

  it('renders a general tab that is displayed by default', () => {
    render(<SettingsPage />);

    const generalTab = screen.getByTestId('settings-general-tab');
    expect(generalTab).toBeInTheDocument();
    expect(screen.getByText('System Configurations')).toBeInTheDocument();
  });

  it('displays correct tab content when a tab is selected', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { role: UserRole.Admin } },
    });

    const { getByTestId } = render(<SettingsPage />);

    fireEvent.click(getByTestId('settings-ai-providers-tab'));
    expect(setActiveSettingsTab).toHaveBeenCalledWith('ai-providers');
    expect(screen.getByText('AI Providers')).toBeInTheDocument();

    fireEvent.click(getByTestId('settings-kb-providers-tab'));
    expect(setActiveSettingsTab).toHaveBeenCalledWith('kb-providers');
    expect(screen.getByText('Knowledge Base Providers')).toBeInTheDocument();

    fireEvent.click(getByTestId('settings-admins-tab'));
    expect(setActiveSettingsTab).toHaveBeenCalledWith('admins');
    expect(screen.getByText('Admins')).toBeInTheDocument();

    fireEvent.click(getByTestId('settings-user-groups-tab'));
    expect(screen.getByText('User Groups')).toBeInTheDocument();

    fireEvent.click(getByTestId('settings-general-tab'));
    expect(screen.getByText('System Configurations')).toBeInTheDocument();

    fireEvent.click(getByTestId('settings-ai-agents-tab'));
    expect(screen.getByText('AI Agents')).toBeInTheDocument();

    fireEvent.click(getByTestId('settings-document-upload-providers-tab'));
    expect(screen.getByText('Document Upload Providers')).toBeInTheDocument();
  });

  it('does not render admin-only tabs for non-admins', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { role: UserRole.User } },
    });

    render(<SettingsPage />);

    expect(screen.queryByTestId('settings-general-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-providers-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-kb-providers-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-document-upload-providers-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-admins-tab')).not.toBeInTheDocument();
    expect(screen.queryByTestId('settings-ai-agents-tab')).not.toBeInTheDocument();
  });

  it('displays admins tab if user is admin', () => {
    (useSession as jest.Mock).mockReturnValue({
      data: { user: { role: UserRole.Admin } },
    });

    render(<SettingsPage />);

    expect(screen.getByTestId('settings-admins-tab')).toBeInTheDocument();
  });
});
