import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import SystemAiProviderModelConfigRow from './SystemAiProviderModelConfigRow';
import useGetModels from '@/features/settings/api/ai-providers/get-models';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';

jest.mock('@/features/settings/api/ai-providers/get-models');
jest.mock('@/features/settings/api/system-configurations/update-system-config');

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('SystemAiProviderModelConfigRow', () => {
  const mockUpdateSystemConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetModels as jest.Mock).mockReturnValue({
      data: {
        models: [
          { id: '1', name: 'Model 1' },
          { id: '2', name: 'Model 2' },
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
          <SystemAiProviderModelConfigRow systemAiProviderModelId={null} />
        </tbody>
      </table>
    );

    const row = screen.getByTestId('system-ai-provider-model-config-row');
    expect(row).toBeInTheDocument();
  });

  it('renders Select with correct options', async () => {
    render(
      <table>
        <tbody>
          <SystemAiProviderModelConfigRow systemAiProviderModelId='1' />
        </tbody>
      </table>
    );

    const select = screen.getByPlaceholderText('No models available');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
      expect(options[0]).toHaveTextContent('Model 1');
      expect(options[1]).toHaveTextContent('Model 2');
    });
  });

  it('calls updateSystemConfig on model change', async () => {
    render(
      <table>
        <tbody>
          <SystemAiProviderModelConfigRow systemAiProviderModelId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByPlaceholderText('No models available');
    fireEvent.mouseDown(select);

    const option = await screen.findByText('Model 1');
    fireEvent.mouseDown(option);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalled();
    });

    expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
      configField: 'systemAiProviderModelId',
      configValue: '1',
    });
  });

  it('selects the correct option when systemAiProviderModelId is provided', async () => {
    render(
      <table>
        <tbody>
          <SystemAiProviderModelConfigRow systemAiProviderModelId='1' />
        </tbody>
      </table>
    );

    const select = screen.getByPlaceholderText('No models available');

    expect(select).toHaveValue('Model 1');

    fireEvent.mouseDown(select);

    const selectedOption = await screen.findByRole('option', {
      selected: true,
    });
    expect(selectedOption).toHaveTextContent('Model 1');
  });
});
