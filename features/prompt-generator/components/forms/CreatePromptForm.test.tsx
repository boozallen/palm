import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck } from '@tabler/icons-react';

import { ViewPromptMessage } from '@/features/shared/components/notifications';
import { useCreatePrompt } from '@/features/shared/api/create-prompt';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetPromptTagSuggestions from '@/features/shared/api/get-prompt-tag-suggestions';
import CreatePromptForm from './CreatePromptForm';
import { usePromptGenerator } from '@/features/prompt-generator/providers';

// Mocks
jest.mock('@mantine/notifications');
jest.mock('@/features/shared/api/create-prompt');
jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/prompt-generator/providers');
jest.mock('@/features/shared/api/get-prompt-tag-suggestions');
jest.mock('@/features/prompt-generator/components/buttons/BackButton', () => ({
  __esModule: true,
  default: ({ onClick }: { onClick: () => void }) => (
    <button data-testid='back-button' type='submit' onClick={onClick}>Back</button>
  ),
}));
jest.mock('@/features/shared/components/forms/inputs/PromptTagsMultiSelect', () => ({
  __esModule: true,
  default: () => <div data-testid='prompt-tags-multiselect' />,
}));
jest.mock('@/features/shared/components/forms/inputs/PromptTagSuggestionContainer', () => ({
  __esModule: true,
  default: () => <div data-testid='prompt-tag-suggestion-container' />,
}));

// Polyfill requestSubmit for JSDOM
beforeAll(() => {
  if (!HTMLFormElement.prototype.requestSubmit) {
    HTMLFormElement.prototype.requestSubmit = function () {
      this.submit();
    };
  }
});

// Shared test data
const mockInitialPrompt = {
  creatorId: '',
  summary: '',
  title: '',
  tags: [],
  description: '',
  example: 'Mock example',
  instructions: 'Mock Instructions',
  config: { randomness: 0.5, repetitiveness: 0.5, model: 'gpt-4o' },
};

let values = { ...mockInitialPrompt };
const isDirty = jest.fn(() => true);
const isValid = jest.fn(() => true);
const validate = jest.fn();
const resetDirty = jest.fn();

// Stub onSubmit to return an event handler
const onSubmit = jest.fn((cb) => (e: React.FormEvent) => {
  e.preventDefault();
  cb(values);
});

// Stub getInputProps to provide controlled inputs
const getInputProps = jest.fn((name: keyof typeof values) => ({
  value: values[name],
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    values[name] = e.target.value as any;
  },
  id: `input-${name}`,
}));

const setFieldValue = jest.fn((name: keyof typeof values, val: any) => {
  values[name] = val;
});

// Mock usePromptGenerator hook
(usePromptGenerator as jest.Mock).mockReturnValue({
  stepper: { previousStep: jest.fn() },
  newPrompt: { isDirty, isValid, validate, values, errors: {}, resetDirty, onSubmit, getInputProps, setFieldValue },
});

describe('CreatePromptForm', () => {
  const renderComponent = () => render(<CreatePromptForm />);

  const mockCreatePrompt = jest.fn();
  const mockGetPromptTagSuggestion = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    values = { ...mockInitialPrompt };

    // Prompt tag suggestions hook
    (useGetPromptTagSuggestions as jest.Mock).mockReturnValue({
      mutate: mockGetPromptTagSuggestion.mockImplementation((_data, { onSuccess }) => {
        onSuccess({ tags: ['mock-tag-1', 'mock-tag-2'] });
      }),
      isPending: false,
    });

    // System config hook
    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { featureManagementPromptTagSuggestions: true },
      isPending: false,
    });

    // Create prompt hook
    (useCreatePrompt as jest.Mock).mockReturnValue({
      mutate: mockCreatePrompt,
      isPending: false,
    });
  });

  it('submits successfully and shows success notification', async () => {
    renderComponent();

    // Stub successful create
    const response = { prompt: { id: '1', ...mockInitialPrompt, title: 'My Title' } };
    mockCreatePrompt.mockImplementation((data, { onSuccess }) => onSuccess(response));

    // Fill form fields
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My Title' } });
    fireEvent.change(screen.getByLabelText('Summary'), { target: { value: 'My Summary' } });
    fireEvent.change(screen.getByLabelText('Description'), { target: { value: 'My Description' } });

    const submitBtn = screen.getByTestId('submit');
    expect(submitBtn).toBeEnabled();
    fireEvent.submit(submitBtn);

    await waitFor(() => {
      expect(mockCreatePrompt).toHaveBeenCalledWith(
        { prompt: values },
        expect.objectContaining({ onSuccess: expect.any(Function), onError: expect.any(Function) })
      );
    });

    await waitFor(() => {
      const notifId = `create_prompt_${response.prompt.id}`;
      expect(notifications.show).toHaveBeenCalledWith({
        id: notifId,
        title: 'Prompt Created',
        message: <ViewPromptMessage title='My Title' promptId={response.prompt.id} notificationId={notifId} />,
        icon: <IconCheck />,
        autoClose: false,
        variant: 'successful_operation',
      });
    });
  });

  it('shows failure notification when create fails', async () => {
    renderComponent();

    // Stub failure
    mockCreatePrompt.mockImplementation((_data, { onError }) => onError(new Error('Test Error')));

    // Ensure form is valid and dirty to enable submit
    isValid.mockReturnValue(true);
    isDirty.mockReturnValue(true);

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'X' } });
    // Other fields not required for this test

    const submitBtn = screen.getByTestId('submit');
    expect(submitBtn).toBeEnabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'create_prompt_failed',
        title: 'Failed to Create Prompt',
        message: 'Test Error',
        icon: <IconX />,
        variant: 'failed_operation',
        autoClose: false,
        withCloseButton: true,
      });
    });
  });

  it('renders PromptTagsMultiSelect', () => {
    renderComponent();
    expect(screen.getByTestId('prompt-tags-multiselect')).toBeInTheDocument();
  });

  it('shows Loading when system config is loading', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({ data: undefined, isPending: true });
    renderComponent();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('renders PromptTagSuggestionIcon when feature flag is on', () => {
    renderComponent();
    expect(screen.getByTestId('prompt-tag-suggestion-icon')).toBeInTheDocument();
  });

  it('does not render PromptTagSuggestionIcon when feature flag is off', () => {
    (useGetSystemConfig as jest.Mock).mockReturnValue({ data: { featureManagementPromptTagSuggestions: false }, isPending: false });
    renderComponent();
    expect(screen.queryByTestId('prompt-tag-suggestion-icon')).not.toBeInTheDocument();
  });

  it('fetches and displays tag suggestions on icon click', async () => {
    // ensure form valid
    isValid.mockReturnValue(true);
    renderComponent();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'T' } });

    fireEvent.click(screen.getByTestId('prompt-tag-suggestion-icon'));
    await waitFor(() => expect(mockGetPromptTagSuggestion).toHaveBeenCalled());
    expect(screen.getByTestId('prompt-tag-suggestion-container')).toBeInTheDocument();
  });

  it('does not fetch suggestions if form is invalid', () => {
    // invalid form
    isValid.mockReturnValue(false);
    renderComponent();
    fireEvent.click(screen.getByTestId('prompt-tag-suggestion-icon'));
    expect(mockGetPromptTagSuggestion).not.toHaveBeenCalled();
    expect(screen.queryByTestId('prompt-tag-suggestion-container')).not.toBeInTheDocument();
  });

  it('shows error notification if suggestions fetch fails', async () => {
    isValid.mockReturnValue(true);
    mockGetPromptTagSuggestion.mockImplementation((_data, { onError }) => onError(new Error('Test Error')));
    renderComponent();
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'T' } });

    fireEvent.click(screen.getByTestId('prompt-tag-suggestion-icon'));
    await waitFor(() => expect(notifications.show).toHaveBeenCalledWith({
      id: 'get_prompt_tag_suggestions',
      title: 'Failed to Get Suggested Prompt Tags',
      message: 'Test Error',
      icon: <IconX />,
      variant: 'failed_operation',
      autoClose: false,
      withCloseButton: true,
    }));
  });

  it('navigates back on BackButton click', () => {
    const { stepper } = usePromptGenerator();
    renderComponent();
    fireEvent.click(screen.getByTestId('back-button'));
    expect(stepper.previousStep).toHaveBeenCalled();
  });
});
