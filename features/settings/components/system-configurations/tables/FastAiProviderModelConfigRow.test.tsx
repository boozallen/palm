import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FastAiProviderModelConfigRow from './FastAiProviderModelConfigRow';
import useGetModels from '@/features/settings/api/ai-providers/get-models';
import { useUpdateSystemConfig } from '@/features/settings/api/system-configurations/update-system-config';

jest.mock('@/features/settings/api/ai-providers/get-models');
jest.mock('@/features/settings/api/system-configurations/update-system-config');

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

describe('FastAiProviderModelConfigRow', () => {
  const mockUpdateSystemConfig = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetModels as jest.Mock).mockReturnValue({
      data: {
        models: [
          { id: '1', name: 'Haiku', embeddingsOnly: false, providerLabel: 'Bedrock' },
          { id: '2', name: 'Sonnet', embeddingsOnly: false, providerLabel: 'Bedrock' },
          { id: '3', name: 'Embedder', embeddingsOnly: true, providerLabel: 'Bedrock' },
        ],
      },
      isPending: false,
      error: null,
    });

    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutateAsync: mockUpdateSystemConfig,
    });
  });

  it('renders the row', () => {
    render(
      <table>
        <tbody>
          <FastAiProviderModelConfigRow fastAiProviderModelId={null} />
        </tbody>
      </table>
    );

    expect(screen.getByTestId('fast-ai-provider-model-config-row')).toBeInTheDocument();
  });

  it('excludes embedding-only models from the options', async () => {
    render(
      <table>
        <tbody>
          <FastAiProviderModelConfigRow fastAiProviderModelId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByPlaceholderText('No models available');
    fireEvent.mouseDown(select);

    await waitFor(() => {
      expect(screen.queryByText('Embedder')).not.toBeInTheDocument();
      expect(screen.getByText('Haiku')).toBeInTheDocument();
      expect(screen.getByText('Sonnet')).toBeInTheDocument();
    });
  });

  it('calls updateSystemConfig with the selected model id', async () => {
    render(
      <table>
        <tbody>
          <FastAiProviderModelConfigRow fastAiProviderModelId={null} />
        </tbody>
      </table>
    );

    const select = screen.getByPlaceholderText('No models available');
    fireEvent.mouseDown(select);

    const option = await screen.findByText('Haiku');
    fireEvent.mouseDown(option);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
        configField: 'fastAiProviderModelId',
        configValue: '1',
      });
    });
  });

  it('calls updateSystemConfig with null when (None) is selected', async () => {
    render(
      <table>
        <tbody>
          <FastAiProviderModelConfigRow fastAiProviderModelId='1' />
        </tbody>
      </table>
    );

    const select = screen.getByPlaceholderText('No models available');
    fireEvent.mouseDown(select);

    const noneOption = await screen.findByText('(None)');
    fireEvent.mouseDown(noneOption);

    await waitFor(() => {
      expect(mockUpdateSystemConfig).toHaveBeenCalledWith({
        configField: 'fastAiProviderModelId',
        configValue: null,
      });
    });
  });

  it('reflects the current fast model as the selected value', () => {
    render(
      <table>
        <tbody>
          <FastAiProviderModelConfigRow fastAiProviderModelId='1' />
        </tbody>
      </table>
    );

    expect(screen.getByPlaceholderText('No models available')).toHaveValue('Haiku');
  });

  it('displays loading while models are pending', () => {
    (useGetModels as jest.Mock).mockReturnValue({
      data: null,
      isPending: true,
      error: null,
    });

    render(
      <table>
        <tbody>
          <FastAiProviderModelConfigRow fastAiProviderModelId={null} />
        </tbody>
      </table>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('displays error message when models fail to load', () => {
    (useGetModels as jest.Mock).mockReturnValue({
      data: null,
      isPending: false,
      error: { message: 'Failed to load models' },
    });

    render(
      <table>
        <tbody>
          <FastAiProviderModelConfigRow fastAiProviderModelId={null} />
        </tbody>
      </table>
    );

    expect(screen.getByText('Failed to load models')).toBeInTheDocument();
  });
});
