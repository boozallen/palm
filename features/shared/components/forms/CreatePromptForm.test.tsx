import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { IconCheck, IconX } from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/router';

import { ViewPromptMessage } from '@/features/shared/components/notifications';
import { useGetAiProviderModelSelectData } from '@/features/shared/data/ai-provider-model-select-data';
import { useCreatePrompt } from '@/features/shared/api/create-prompt';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetPromptTagSuggestions from '@/features/shared/api/get-prompt-tag-suggestions';
import CreatePromptForm from './CreatePromptForm';

jest.mock('@mantine/core', () => {
  const actualMantine = jest.requireActual('@mantine/core');
  return {
    ...actualMantine,
    Slider: ({ thumbLabel, value, onChange, onFocus, onBlur }: {
      thumbLabel?: string;
      value: number;
      onChange?: (value: number) => void;
      onFocus?: React.FocusEventHandler<HTMLInputElement>;
      onBlur?: React.FocusEventHandler<HTMLInputElement>;
    }) => (
      <div data-testid='mock-slider-container'>
        <label id={`${thumbLabel ?? 'slider'}-label`}>{thumbLabel}</label>
        <input
          type='range'
          aria-labelledby={`${thumbLabel ?? 'slider'}-label`}
          data-testid='mock-slider'
          aria-valuenow={value}
          min='0'
          max='1'
          step='0.1'
          value={String(value || 0)}
          onChange={(e) => onChange && onChange(parseFloat(e.target.value))}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </div>
    ),
  };
});

jest.mock('@mantine/notifications');
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

jest.mock('@/features/shared/data/ai-provider-model-select-data');
jest.mock('@/features/shared/api/create-prompt');
jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/get-prompt-tag-suggestions');

const mockTags = ['mock-tag-1', 'mock-tag-2'];
jest.mock('./inputs/PromptTagsMultiSelect', () => {
  return function MockPromptTagsMultiSelect() {
    return (
      <div data-testid='prompt-tags-multiselect'>{mockTags.join(',')}</div>
    );
  };
});

jest.mock('./inputs/PromptTagSuggestionContainer', () => {
  return function MockPromptTagSuggestionContainer() {
    return <div data-testid='prompt-tag-suggestion-container' />;
  };
});

describe('CreatePromptForm', () => {
  function fillFormValues() {
    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: mockReturnValue.prompt.title },
    });
  }

  const mockCreatePrompt = jest.fn();
  const mockGetPromptTagSuggestion = jest.fn();

  const mockPrompt = {
    config: {
      model: 'GPT 4o',
      randomness: 0.5,
      repetitiveness: 0.5,
    },
    description: 'Mock Description',
    example: 'Mock Example',
    instructions: 'Mock Instructions',
    summary: 'Mock Summary',
    tags: mockTags,
    title: 'Mock Prompt',
  };

  const mockReturnValue = {
    prompt: {
      ...mockPrompt,
      creatorId: 'a1ef51cd-49d7-440b-868f-d674791d3c32',
      id: '0a94312c-37b2-4ee2-b89c-7d0e11c58a31',
    },
  };

  let mockRouter: {
    query: Record<string, string>;
    back: jest.Mock;
    push: jest.Mock;
    asPath?: string;
  };

  beforeEach(() => {
    jest.clearAllMocks();

    (useGetAiProviderModelSelectData as jest.Mock).mockReturnValue({
      modelOptions: [
        {
          value: 'cf127351-3492-40ac-96b4-271a746e9f96',
          label: 'GPT 4o',
          group: 'OpenAI',
        },
      ],
    });

    (useCreatePrompt as jest.Mock).mockReturnValue({
      mutate: mockCreatePrompt,
      isPending: false,
      error: null,
    });

    (useGetPromptTagSuggestions as jest.Mock).mockReturnValue({
      mutate: mockGetPromptTagSuggestion.mockImplementation((_data, { onSuccess }) => {
        onSuccess({ tags: mockTags });
      }),
      isPending: false,
    });

    (useGetSystemConfig as jest.Mock).mockReturnValue({
      data: { featureManagementPromptTagSuggestions: true },
      isPending: false,
    });

    mockRouter = {
      query: {},
      back: jest.fn(),
      push: jest.fn(),
      asPath: '/create-prompt',
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
  });

  describe('Form initialization', () => {
    it('renders the form', () => {
      render(<CreatePromptForm />);

      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Summary')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByLabelText('Example')).toBeInTheDocument();
      expect(screen.getByLabelText('Instructions')).toBeInTheDocument();
      expect(screen.getByLabelText(/^Randomness/)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Repetitiveness/)).toBeInTheDocument();
      expect(screen.getByLabelText('Language model')).toBeInTheDocument();
      expect(screen.getByTestId('prompt-tags-multiselect')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
      expect(screen.getByText('Create Prompt')).toBeInTheDocument();
    });

    it('sets the initial values for relevant prompt fields except title', () => {
      render(<CreatePromptForm prompt={mockPrompt} />);

      expect(screen.getByLabelText('Title')).toHaveValue('');
      expect(screen.getByLabelText('Summary')).toHaveValue(mockPrompt.summary);
      expect(screen.getByLabelText('Description')).toHaveValue(
        mockPrompt.description
      );
      expect(screen.getByLabelText('Example')).toHaveValue(mockPrompt.example);
      expect(screen.getByLabelText('Instructions')).toHaveValue(
        mockPrompt.instructions
      );
      expect(screen.getByLabelText('Randomness')).toHaveAttribute(
        'aria-valuenow',
        mockPrompt.config.randomness.toString()
      );
      expect(screen.getByLabelText('Repetitiveness')).toHaveAttribute(
        'aria-valuenow',
        mockPrompt.config.repetitiveness.toString()
      );
      expect(screen.getByLabelText('Language model')).toHaveValue(
        mockPrompt.config.model
      );
      expect(screen.getByTestId('prompt-tags-multiselect')).toHaveTextContent(
        mockTags.join(',')
      );
    });

    it('should display detailed notification and go back when not from library', async () => {
      render(<CreatePromptForm prompt={mockPrompt} />);

      mockCreatePrompt.mockImplementation((data, { onSuccess }) => {
        onSuccess(mockReturnValue);
      });

      fillFormValues();

      const submitButton = screen.getByTestId('submit');
      expect(submitButton).toBeEnabled();
      fireEvent.click(submitButton);

      expect(mockCreatePrompt).toHaveBeenCalled();

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          id: 'create_prompt',
          title: 'Prompt Created',
          message: (
            <ViewPromptMessage
              title={'Mock Prompt'}
              promptId={'0a94312c-37b2-4ee2-b89c-7d0e11c58a31'}
              notificationId='create_prompt'
            />
          ),
          autoClose: false,
          icon: <IconCheck />,
          variant: 'successful_operation',
        });
        expect(mockRouter.back).toHaveBeenCalled();
        expect(mockRouter.push).not.toHaveBeenCalled();
      });
    });

    it('should display notification error if theres an error', async () => {
      render(<CreatePromptForm prompt={mockPrompt} />);

      mockCreatePrompt.mockImplementation((data, { onError }) => {
        onError('Failed to create');
      });

      fillFormValues();

      const submitButton = screen.getByTestId('submit');
      expect(submitButton).toBeEnabled();
      fireEvent.click(submitButton);

      expect(mockCreatePrompt).toHaveBeenCalled();

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          id: 'create_prompt',
          title: 'Failed to Create Prompt',
          message: 'Could not create prompt. Please try again later.',
          autoClose: false,
          icon: <IconX />,
          variant: 'failed_operation',
          withCloseButton: true,
        });
      });
    });

    it('renders description for example input', () => {
      render(<CreatePromptForm />);
      const description = screen.getByText(/Enter an example such as/);

      expect(description).toBeInTheDocument();
    });

    it('renders description for instructions input', () => {
      render(<CreatePromptForm />);
      const description = screen.getByText(
        /Provide clear, detailed instructions/
      );

      expect(description).toBeInTheDocument();
    });

    it('renders loading state while fetching system config', () => {
      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: undefined,
        isPending: true,
      });

      render(<CreatePromptForm />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render PromptTagSuggestionIcon when feature management is enabled', () => {
      render(<CreatePromptForm />);

      expect(
        screen.queryByTestId('prompt-tag-suggestion-icon')
      ).toBeInTheDocument();
    });

    it('should not render PromptTagSuggestionIcon when feature management is disabled', () => {
      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: { featureManagementPromptTagSuggestions: false },
        isPending: false,
      });

      render(<CreatePromptForm />);

      expect(
        screen.queryByTestId('prompt-tag-suggestion-icon')
      ).not.toBeInTheDocument();
    });

    it('should render PromptTagSuggestionContainer', async () => {
      render(<CreatePromptForm prompt={mockPrompt} />);

      fillFormValues();

      const icon = screen.getByTestId('prompt-tag-suggestion-icon');
      await waitFor(() => {
        fireEvent.click(icon);
      });

      expect(
        screen.queryByTestId('prompt-tag-suggestion-container')
      ).toBeInTheDocument();
    });

    it('should call getPromptTagSuggestions when IconSparkles is clicked', async () => {
      mockGetPromptTagSuggestion.mockImplementation((data, { onSuccess }) => {
        onSuccess({ tags: ['tag1', 'tag2'] });
      });

      render(<CreatePromptForm prompt={mockPrompt} />);

      fillFormValues();

      const icon = screen.getByTestId('prompt-tag-suggestion-icon');
      await waitFor(async () => {
        fireEvent.click(icon);
      });

      expect(mockGetPromptTagSuggestion).toHaveBeenCalled();
    });

    it('should not render PromptTagSuggestionContainer when IconSparkles is clicked without valid form', async () => {
      const mockInstructionsInput = { instructions: 'Mock Instructions' };

      render(<CreatePromptForm prompt={mockInstructionsInput} />);

      const icon = screen.getByTestId('prompt-tag-suggestion-icon');
      await waitFor(() => {
        fireEvent.click(icon);
      });

      expect(mockGetPromptTagSuggestion).not.toHaveBeenCalled();
      expect(
        screen.queryByTestId('prompt-tag-suggestion-container')
      ).not.toBeInTheDocument();
    });

    it('should render PromptTagSuggestionContainer when getPromptTagSuggestions returns empty array', async () => {
      mockGetPromptTagSuggestion.mockImplementation((_data, { onSuccess }) => {
        onSuccess({ tags: [] });
      });

      render(<CreatePromptForm prompt={mockPrompt} />);

      expect(
        screen.queryByTestId('prompt-tag-suggestion-container')
      ).not.toBeInTheDocument();

      fillFormValues();

      const icon = screen.getByTestId('prompt-tag-suggestion-icon');
      await waitFor(() => {
        fireEvent.click(icon);
      });

      expect(
        screen.getByTestId('prompt-tag-suggestion-container')
      ).toBeInTheDocument();
    });
  });

  it('should display error notification if getPromptTagSuggestions fails', async () => {
    render(<CreatePromptForm prompt={mockPrompt} />);

    mockGetPromptTagSuggestion.mockImplementation((_data, { onError }) => {
      onError('Failed to get suggestions');
    });

    fillFormValues();

    const icon = screen.getByTestId('prompt-tag-suggestion-icon');
    fireEvent.click(icon);

    expect(mockGetPromptTagSuggestion).toHaveBeenCalled();

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'get_prompt_tag_suggestions',
        title: 'Failed to Get Suggested Prompt Tags',
        message: 'Could not get suggested prompt tags. Please try again later.',
        autoClose: false,
        icon: <IconX />,
        variant: 'failed_operation',
        withCloseButton: true,
      });
    });
  });

  it('should display simple notification and navigate to prompt when from library', async () => {
    mockRouter.query = { fromLibrary: 'true' };

    render(<CreatePromptForm prompt={mockPrompt} />);

    mockCreatePrompt.mockImplementation((data, { onSuccess }) => {
      onSuccess(mockReturnValue);
    });

    fillFormValues();

    const submitButton = screen.getByTestId('submit');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(notifications.show).toHaveBeenCalledWith({
        id: 'create_prompt',
        title: 'Prompt Created',
        message: 'You have successfully created a new prompt.',
        icon: <IconCheck />,
        autoClose: true,
        variant: 'successful_operation',
      });
      expect(mockRouter.push).toHaveBeenCalledWith(
        '/library/mock-prompt/0a94312c-37b2-4ee2-b89c-7d0e11c58a31'
      );
      expect(mockRouter.back).not.toHaveBeenCalled();
    });
  });

  describe('Cancel button behavior', () => {
    it('should call router.back() when cancel button is clicked and not from prompt playground or library', () => {
      render(<CreatePromptForm />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockRouter.back).toHaveBeenCalled();
      expect(mockRouter.push).not.toHaveBeenCalled();
    });

    it('should navigate back to playground with data when cancel button is clicked and from prompt playground', () => {
      const mockPromptData = JSON.stringify({
        prompt: 'Test prompt',
        config: { randomness: 0.5, repetitiveness: 0.5, model: 'gpt-3' },
      });
      mockRouter.query = {
        promptData: mockPromptData,
        fromPlayground: 'true',
      };

      render(<CreatePromptForm />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/prompt-playground',
        query: { returnedPromptData: mockPromptData },
      });
      expect(mockRouter.back).not.toHaveBeenCalled();
    });

    it('should navigate back to library page with data when cancel button is clicked and from library', () => {
      const mockPromptData = JSON.stringify({
        prompt: 'Test prompt',
        config: { randomness: 0.5, repetitiveness: 0.5, model: 'gpt-3' },
      });
      mockRouter.query = {
        promptData: mockPromptData,
        fromLibrary: 'true',
        originalPath: '/library/some-slug/some-id',
      };

      render(<CreatePromptForm />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockRouter.push).toHaveBeenCalledWith({
        pathname: '/library/some-slug/some-id',
        query: { returnedPromptData: mockPromptData },
      });
      expect(mockRouter.back).not.toHaveBeenCalled();
    });
  });
});
