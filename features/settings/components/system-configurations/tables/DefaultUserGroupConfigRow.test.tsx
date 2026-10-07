import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import DefaultUserGroupConfigRow from './DefaultUserGroupConfigRow';
import useGetUserGroups from '@/features/settings/api/user-groups/get-user-groups';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';

jest.mock('@/features/settings/api/user-groups/get-user-groups');
jest.mock('@/features/settings/api/system-configurations/update-system-config');

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('DefaultUserGroupConfigRow', () => {
  const mockUpdateSystemConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetUserGroups as jest.Mock).mockReturnValue({
      data: {
        userGroups: [
          { id: '1', label: 'Group 1' },
          { id: '2', label: 'Group 2' },
        ],
      },
      isPending: false,
      error: null,
    });

    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateSystemConfig,
    });
  });

  it('renders without crashing', () => {
    render(
      <table>
        <tbody>
          <DefaultUserGroupConfigRow defaultUserGroupId={null} />
        </tbody>
      </table>
    );

    const row = screen.getByTestId('default-user-group-config-row');
    expect(row).toBeInTheDocument();
  });

  it('renders Select with correct options', async () => {
    render(
      <table>
        <tbody>
          <DefaultUserGroupConfigRow defaultUserGroupId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('default-user-group-select');

    fireEvent.mouseDown(select);

    expect(await screen.findByText('(None)')).toBeInTheDocument();
    expect(await screen.findByText('Group 1')).toBeInTheDocument();
    expect(await screen.findByText('Group 2')).toBeInTheDocument();
  });

  it('calls updateSystemConfig when a new option is selected', async () => {
    render(
      <table>
        <tbody>
          <DefaultUserGroupConfigRow defaultUserGroupId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('default-user-group-select');

    fireEvent.mouseDown(select);

    const option = await screen.findByText('Group 1');
    fireEvent.mouseDown(option);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalled();
    });

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
      configField: 'defaultUserGroupId',
      configValue: '1',
    });
  });

  it('selects the correct option when defaultUserGroupId is provided', async () => {
    render(
      <table>
        <tbody>
          <DefaultUserGroupConfigRow defaultUserGroupId='2' />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('default-user-group-select');

    expect(select).toHaveValue('Group 2');
  });

  it('calls updateSystemConfig with null when (None) is selected', async () => {
    render(
      <table>
        <tbody>
          <DefaultUserGroupConfigRow defaultUserGroupId='2' />
        </tbody>
      </table>
    );

    const select = screen.getByTestId('default-user-group-select');

    fireEvent.mouseDown(select);

    const noneOption = await screen.findByText('(None)');
    fireEvent.mouseDown(noneOption);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalled();
    });

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
      configField: 'defaultUserGroupId',
      configValue: null,
    });
  });
});
