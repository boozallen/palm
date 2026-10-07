import { render, screen, fireEvent, act } from '@testing-library/react';

import Form, { Value } from './Form';
import useGetAvailableModels from '@/features/shared/api/get-available-models';

jest.mock('@/features/shared/api/get-available-models');

describe('Form', () => {
  const mockAgentId = '212a5a1a-77a3-42e4-a143-7c43b87f0fd3';
  const mockOnSubmit = jest.fn();

  const mockModelData = {
    availableModels: [
      { id: 'gpt-4', name: 'GPT-4', providerLabel: 'OpenAI' },
      { id: 'claude-3', name: 'Claude 3', providerLabel: 'Anthropic' },
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: mockModelData,
    });
  });

  it('should render the form', () => {
    render(
      <Form
        agentId={mockAgentId}
        onSubmit={mockOnSubmit}
        isLoading={false}
        hasSubmitted={false}
      />
    );

    expect(screen.getByText('Upload Warrant')).toBeInTheDocument();
    expect(screen.getByLabelText('Search Warrant File')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Analyze' })).toBeInTheDocument();
  });

  it('should disable inputs when loading', () => {
    render(
      <Form
        agentId={mockAgentId}
        onSubmit={mockOnSubmit}
        isLoading={true}
        hasSubmitted={false}
      />
    );

    expect(screen.getByLabelText('Search Warrant File')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Analyzing...' })).toHaveAttribute('data-loading', 'true');
  });

  it('should show validation errors when submitting empty form', async () => {
    render(
      <Form
        agentId={mockAgentId}
        onSubmit={mockOnSubmit}
        isLoading={false}
        hasSubmitted={false}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Analyze' });

    await act(async () => {
      fireEvent.click(submitButton);
    });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it('should disable analyze button when no file or model is selected', () => {
    render(
      <Form
        agentId={mockAgentId}
        onSubmit={mockOnSubmit}
        isLoading={false}
        hasSubmitted={false}
      />
    );

    const submitButton = screen.getByRole('button', { name: 'Analyze' });
    expect(submitButton).toBeDisabled();
  });

  it('should disable analyze button when only file is selected', async () => {
    render(
      <Form
        agentId={mockAgentId}
        onSubmit={mockOnSubmit}
        isLoading={false}
        hasSubmitted={false}
      />
    );

    const fileInput = screen.getByLabelText('Search Warrant File');
    const mockFile = new File(['content'], 'test-warrant.pdf', {
      type: 'application/pdf',
    });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [mockFile] } });
    });

    const submitButton = screen.getByRole('button', { name: 'Analyze' });
    expect(submitButton).toBeDisabled();
  });

  it('should disable analyze button when only model is selected', () => {
    render(
      <Form
        agentId={mockAgentId}
        onSubmit={mockOnSubmit}
        isLoading={false}
        hasSubmitted={false}
      />
    );

    const modelSelect = screen.getByPlaceholderText('Select model');

    fireEvent.mouseDown(modelSelect);
    fireEvent.mouseDown(screen.getByText('GPT-4'));

    const submitButton = screen.getByRole('button', { name: 'Analyze' });
    expect(submitButton).toBeDisabled();
  });

  it('should populate model select options from API', () => {
    render(
      <Form
        agentId={mockAgentId}
        onSubmit={mockOnSubmit}
        isLoading={false}
        hasSubmitted={false}
      />
    );

    // The select should be rendered with model label
    expect(screen.getByText('Model')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Select model')).toBeInTheDocument();
  });

  it('should handle empty model data', () => {
    (useGetAvailableModels as jest.Mock).mockReturnValue({
      data: null,
    });

    render(
      <Form
        agentId={mockAgentId}
        onSubmit={mockOnSubmit}
        isLoading={false}
        hasSubmitted={false}
      />
    );

    expect(screen.getByLabelText('Search Warrant File')).toBeInTheDocument();
  });
});

describe('Value component', () => {
  it('should render file name', () => {
    const mockFile = new File(['content'], 'test-warrant.pdf', {
      type: 'application/pdf',
    });

    render(<Value file={mockFile} />);

    expect(screen.getByText('test-warrant.pdf')).toBeInTheDocument();
  });
});
