import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { notifications } from '@mantine/notifications';
import PromptTagsSelectAndSuggestions from './PromptTagsSelectAndSuggestions';
import useGetPromptTagSuggestions from '@/features/shared/api/get-prompt-tag-suggestions';

// Mock dependencies
jest.mock('@/features/shared/api/get-prompt-tag-suggestions');
jest.mock('@mantine/notifications');
jest.mock('./PromptTagsMultiSelect', () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid='prompt-tags-multi-select' />),
}));
jest.mock('@/features/shared/components/elements/PromptTagSuggestionIcon', () => ({
  __esModule: true,
  default: jest.fn(({ onClick, enabled, isLoading }) => (
    <button
      data-testid='suggestion-icon'
      onClick={onClick}
      disabled={!enabled}
      data-loading={isLoading}
    >
      Suggest Tags
    </button>
  )),
}));
jest.mock('./PromptTagSuggestionContainer', () => ({
  __esModule: true,
  default: jest.fn(({ tags, onAccept, onClose }) => (
    <div data-testid='suggestion-container'>
      {tags.map((tag: string) => (
        <div key={tag} data-testid='suggested-tag'>{tag}</div>
      ))}
      <button
        data-testid='accept-button'
        onClick={() => onAccept(tags)}
      >
        Accept
      </button>
      <button
        data-testid='close-button'
        onClick={onClose}
      >
        Close
      </button>
    </div>
  )),
}));

describe('PromptTagsSelectAndSuggestions', () => {
  const mockForm = {
    values: {
      title: 'Test Title',
      description: 'Test Description',
      prompt: 'Test Prompt',
      tags: ['existing-tag'],
    },
    errors: {},
    validate: jest.fn(),
    isValid: jest.fn(() => true),
    setFieldValue: jest.fn(),
  };

  const mockMutate = jest.fn();
  const mockUseGetPromptTagSuggestions = useGetPromptTagSuggestions as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseGetPromptTagSuggestions.mockReturnValue({
      mutate: mockMutate,
      isPending: false,
    });
  });

  test('renders PromptTagsMultiSelect component', () => {
    render(
      <PromptTagsSelectAndSuggestions
        form={mockForm as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    expect(screen.getByTestId('prompt-tags-multi-select')).toBeInTheDocument();
  });

  test('renders suggestion icon when promptTagSuggestionsEnabled is true', () => {
    render(
      <PromptTagsSelectAndSuggestions
        form={mockForm as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    expect(screen.getByTestId('suggestion-icon')).toBeInTheDocument();
  });

  test('does not render suggestion icon when promptTagSuggestionsEnabled is false', () => {
    render(
      <PromptTagsSelectAndSuggestions
        form={mockForm as any}
        promptTagSuggestionsEnabled={false}
      />
    );

    expect(screen.queryByTestId('suggestion-icon')).not.toBeInTheDocument();
  });

  test('disables suggestion icon when form has errors', () => {
    const formWithErrors = {
      ...mockForm,
      errors: { title: 'Title is required' },
    };

    render(
      <PromptTagsSelectAndSuggestions
        form={formWithErrors as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    expect(screen.getByTestId('suggestion-icon')).toBeDisabled();
  });

  test('shows loading state on suggestion icon during API call', () => {
    mockUseGetPromptTagSuggestions.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    });

    render(
      <PromptTagsSelectAndSuggestions
        form={mockForm as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    expect(screen.getByTestId('suggestion-icon').getAttribute('data-loading')).toBe('true');
  });

  test('calls getPromptTagSuggestions when suggestion icon is clicked', () => {
    render(
      <PromptTagsSelectAndSuggestions
        form={mockForm as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    fireEvent.click(screen.getByTestId('suggestion-icon'));

    expect(mockForm.validate).toHaveBeenCalled();
    expect(mockForm.isValid).toHaveBeenCalled();
    expect(mockMutate).toHaveBeenCalledWith(
      { prompt: mockForm.values },
      expect.objectContaining({
        onSuccess: expect.any(Function),
        onError: expect.any(Function),
      })
    );
  });

  test('does not call API when form is invalid', () => {
    const invalidForm = {
      ...mockForm,
      isValid: jest.fn(() => false),
    };

    render(
      <PromptTagsSelectAndSuggestions
        form={invalidForm as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    fireEvent.click(screen.getByTestId('suggestion-icon'));

    expect(invalidForm.validate).toHaveBeenCalled();
    expect(invalidForm.isValid).toHaveBeenCalled();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  test('shows suggestion container when API call succeeds', async () => {
    // Mock successful API response
    mockMutate.mockImplementation((params, options) => {
      options.onSuccess({ tags: ['tag1', 'tag2', 'tag3'] });
    });

    render(
      <PromptTagsSelectAndSuggestions
        form={mockForm as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    fireEvent.click(screen.getByTestId('suggestion-icon'));

    expect(screen.getByTestId('suggestion-container')).toBeInTheDocument();
    expect(screen.getAllByTestId('suggested-tag')).toHaveLength(3);
    expect(screen.getAllByTestId('suggested-tag')[0]).toHaveTextContent('tag1');
    expect(screen.getAllByTestId('suggested-tag')[1]).toHaveTextContent('tag2');
    expect(screen.getAllByTestId('suggested-tag')[2]).toHaveTextContent('tag3');
  });

  test('does not show suggestion container while pending', () => {
    mockUseGetPromptTagSuggestions.mockReturnValue({
      mutate: mockMutate,
      isPending: true,
    });

    // Mock successful API response
    mockMutate.mockImplementation((params, options) => {
      options.onSuccess({ tags: ['tag1', 'tag2'] });
    });

    render(
      <PromptTagsSelectAndSuggestions
        form={mockForm as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    fireEvent.click(screen.getByTestId('suggestion-icon'));

    expect(screen.queryByTestId('suggestion-container')).not.toBeInTheDocument();
  });

  test('shows notification when API call fails', () => {
    // Mock API error
    const mockError = new Error('API Error');
    mockMutate.mockImplementation((params, options) => {
      options.onError(mockError);
    });

    render(
      <PromptTagsSelectAndSuggestions
        form={mockForm as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    fireEvent.click(screen.getByTestId('suggestion-icon'));

    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
      id: 'get_prompt_tag_suggestions',
      title: 'Failed to Get Suggested Prompt Tags',
      message: 'API Error',
      variant: 'failed_operation',
    }));
  });

  test('updates form tags when suggestion is accepted', () => {
    // Mock successful API response
    mockMutate.mockImplementation((params, options) => {
      options.onSuccess({ tags: ['tag1', 'tag2'] });
    });

    render(
      <PromptTagsSelectAndSuggestions
        form={mockForm as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    fireEvent.click(screen.getByTestId('suggestion-icon'));
    fireEvent.click(screen.getByTestId('accept-button'));

    expect(mockForm.setFieldValue).toHaveBeenCalledWith('tags', ['tag1', 'tag2']);
  });

  test('closes suggestion container when close button is clicked', () => {
    // Mock successful API response
    mockMutate.mockImplementation((params, options) => {
      options.onSuccess({ tags: ['tag1', 'tag2'] });
    });

    render(
      <PromptTagsSelectAndSuggestions
        form={mockForm as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    fireEvent.click(screen.getByTestId('suggestion-icon'));
    expect(screen.getByTestId('suggestion-container')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('close-button'));
    expect(screen.queryByTestId('suggestion-container')).not.toBeInTheDocument();
  });

  test('uses custom error message when API error has no message', () => {
    // Mock API error without message
    const mockError = new Error();
    mockError.message = '';

    mockMutate.mockImplementation((params, options) => {
      options.onError(mockError);
    });

    render(
      <PromptTagsSelectAndSuggestions
        form={mockForm as any}
        promptTagSuggestionsEnabled={true}
      />
    );

    fireEvent.click(screen.getByTestId('suggestion-icon'));

    expect(notifications.show).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Could not get suggested prompt tags. Please try again later.',
    }));
  });
});
