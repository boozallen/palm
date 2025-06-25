import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { notifications } from '@mantine/notifications';
import { IconX, IconCheck } from '@tabler/icons-react';

import { Prompt } from '@/features/shared/types';
import { useGetAiProviderModelSelectData } from '@/features/shared/data/ai-provider-model-select-data';
import { useGetSystemConfig } from '@/features/shared/api/get-system-config';
import useGetPromptTagSuggestions from '@/features/shared/api/get-prompt-tag-suggestions';
import useUpdatePrompt from '@/features/library/api/update-prompt';
import EditPromptForm from './EditPromptForm';
import { ViewPromptMessage } from '@/features/shared/components/notifications';

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

jest.mock('@/features/shared/data/ai-provider-model-select-data');
jest.mock('@/features/shared/api/get-system-config');
jest.mock('@/features/shared/api/get-prompt-tag-suggestions');
jest.mock('@/features/library/api/update-prompt');

jest.mock('@/features/shared/components/forms/inputs/PromptTagsMultiSelect', () => {
  return function MockPromptTagsMultiSelect() {
    return (
      <div data-testid='prompt-tags-multiselect'>
        {mockPrompt.tags.join(',')}
      </div>
    );
  };
});

jest.mock('@/features/shared/components/forms/inputs/PromptTagSuggestionContainer', () => {
  return function MockPromptTagSuggestionContainer() {
    return (
      <div data-testid='prompt-tag-suggestion-container' />
    );
  };
});

global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const mockTags = { tags: ['mock-tag-1', 'mock-tag-2', 'mock-tag-3', 'mock-tag-4'] };

const mockModels = [
  { value: 'mock-model-1', label: 'Mock Model 1', group: 'Mock Group 1' },
  { value: 'mock-model-2', label: 'Mock Model 2', group: 'Mock Group 1' },
  { value: 'mock-model-3', label: 'Mock Model 1', group: 'Mock Group 2' },
  { value: 'mock-model-4', label: 'Mock Model 2', group: 'Mock Group 2' },
];

const mockPrompt: Prompt = {
  id: 'd7164c5f-ccd4-4a13-aa0c-4df7548f991a',
  creatorId: 'a1ef51cd-49d7-440b-868f-d674791d3c32',
  title: 'Mock Prompt',
  summary: 'Mock Summary',
  description: 'Mock Description',
  instructions: 'Mock Instructions',
  example: 'Mock Example',
  tags: [mockTags.tags[0], mockTags.tags[1]],
  config: {
    randomness: 0.5,
    model: mockModels[0].value,
    repetitiveness: 0.5,
  },
};

describe('EditPromptForm', () => {

  const mockUpdatePrompt = jest.fn();
  const mockGetPromptTagSuggestion = jest.fn();

  beforeEach(() => {
    jest.resetAllMocks();

    (useGetAiProviderModelSelectData as jest.Mock).mockReturnValue({
      modelOptions: mockModels,
    });

    (useUpdatePrompt as jest.Mock).mockReturnValue({
      mutate: mockUpdatePrompt,
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
  });

  describe('Form Initialization', () => {

    it('renders the correct form fields', () => {
      render(<EditPromptForm prompt={mockPrompt} />);

      expect(screen.queryByLabelText('Title')).toBeInTheDocument();
      expect(screen.queryByLabelText('Summary')).toBeInTheDocument();
      expect(screen.queryByLabelText('Description')).toBeInTheDocument();
      expect(screen.queryByLabelText('Example')).toBeInTheDocument();
      expect(screen.queryByLabelText('Instructions')).toBeInTheDocument();
      expect(screen.queryByLabelText('Language model')).toBeInTheDocument();
      expect(screen.queryByLabelText('Randomness')).toBeInTheDocument();
      expect(screen.queryByLabelText('Repetitiveness')).toBeInTheDocument();
      expect(screen.getByTestId('prompt-tags-multiselect')).toBeInTheDocument();
    });

    it('populates the form with the correct values', () => {
      render(<EditPromptForm prompt={mockPrompt} />);

      expect(screen.getByLabelText('Title')).toHaveValue(mockPrompt.title);
      expect(screen.getByLabelText('Summary')).toHaveValue(mockPrompt.summary);
      expect(screen.getByLabelText('Description')).toHaveValue(mockPrompt.description);
      expect(screen.getByLabelText('Example')).toHaveValue(mockPrompt.example);
      expect(screen.getByLabelText('Instructions')).toHaveValue(mockPrompt.instructions);
      expect(screen.getByLabelText('Language model')).toHaveValue(mockModels[0].label);
      expect(screen.getByLabelText('Randomness')).toHaveAttribute('aria-valuenow', mockPrompt.config.randomness.toString());
      expect(screen.getByLabelText('Repetitiveness')).toHaveAttribute('aria-valuenow', mockPrompt.config.repetitiveness.toString());
      expect(screen.getByTestId('prompt-tags-multiselect')).toHaveTextContent(mockPrompt.tags.join(','));
    });

    it('renders description for example input', () => {
      render(<EditPromptForm prompt={mockPrompt} />);

      const description = screen.getByText(/Enter an example such as/);

      expect(description).toBeInTheDocument();
    });

    it('renders description for instructions input', () => {
      render(<EditPromptForm prompt={mockPrompt} />);

      const description = screen.getByText(/Provide clear, detailed instructions/);

      expect(description).toBeInTheDocument();
    });

    it('renders loading state while fetching system config', () => {
      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: undefined,
        isPending: true,
      });

      render(<EditPromptForm prompt={mockPrompt} />);

      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('should render PromptTagSuggestionIcon when feature management is enabled', () => {
      render(<EditPromptForm prompt={mockPrompt} />);

      expect(screen.queryByTestId('prompt-tag-suggestion-icon')).toBeInTheDocument();
    });

    it('should not render PromptTagSuggestionIcon when feature management is disabled', () => {
      (useGetSystemConfig as jest.Mock).mockReturnValue({
        data: { featureManagementPromptTagSuggestions: false },
        isPending: false,
      });

      render(<EditPromptForm prompt={mockPrompt} />);

      expect(screen.queryByTestId('prompt-tag-suggestion-icon')).not.toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {

    const mockUpdatedPrompt: Prompt = {
      id: 'd7164c5f-ccd4-4a13-aa0c-4df7548f991a',
      creatorId: 'a1ef51cd-49d7-440b-868f-d674791d3c32',
      title: 'New Mock Prompt',
      summary: 'New Mock Summary',
      description: 'New Mock Description',
      instructions: 'New Mock Instructions',
      example: 'New Mock Example',
      tags: [mockTags.tags[0], mockTags.tags[1]],
      config: {
        randomness: 0.5,
        model: mockModels[0].value,
        repetitiveness: 0.5,
      },
    };

    function setupFormWithUpdatedValues() {
      fireEvent.change(screen.getByLabelText('Title'), { target: { value: mockUpdatedPrompt.title } });
      fireEvent.change(screen.getByLabelText('Summary'), { target: { value: mockUpdatedPrompt.summary } });
      fireEvent.change(screen.getByLabelText('Description'), { target: { value: mockUpdatedPrompt.description } });
      fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: mockUpdatedPrompt.instructions } });
      fireEvent.change(screen.getByLabelText('Example'), { target: { value: mockUpdatedPrompt.example } });
    }

    it('will not submit if form is not dirty', () => {
      render(<EditPromptForm prompt={mockPrompt} />);

      const submitButton = screen.getByTestId('submit-edit-prompt-button');
      expect(submitButton).toBeDisabled();
      fireEvent.click(submitButton);

      expect(mockUpdatePrompt).not.toHaveBeenCalled();
    });

    it('submits form with updated values and displays notification on successful prompt edit', async () => {
      mockUpdatePrompt.mockImplementation((data, { onSuccess }) => {
        onSuccess(mockUpdatedPrompt);
      });

      render(<EditPromptForm prompt={mockPrompt} />);

      setupFormWithUpdatedValues();

      const submitButton = screen.getByTestId('submit-edit-prompt-button');
      fireEvent.click(submitButton);

      expect(mockUpdatePrompt).toHaveBeenCalledWith({
        id: mockUpdatedPrompt.id,
        title: mockUpdatedPrompt.title,
        summary: mockUpdatedPrompt.summary,
        description: mockUpdatedPrompt.description,
        instructions: mockUpdatedPrompt.instructions,
        example: mockUpdatedPrompt.example,
        model: mockUpdatedPrompt.config.model,
        randomness: mockUpdatedPrompt.config.randomness,
        repetitiveness: mockUpdatedPrompt.config.repetitiveness,
        tags: mockUpdatedPrompt.tags,
      },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        }));

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          id: 'update_prompt',
          title: 'Prompt Updated',
          message: <ViewPromptMessage promptId={mockUpdatedPrompt.id} title={mockUpdatedPrompt.title} notificationId='update_prompt' />,
          icon: <IconCheck />,
          autoClose: true,
          variant: 'successful_operation',
        });
      });
    });

    it('displays notification if error submitting prompt', async () => {
      mockUpdatePrompt.mockImplementation((data, { onError }) => {
        onError('Failed to update');
      });

      render(<EditPromptForm prompt={mockPrompt} />);

      setupFormWithUpdatedValues();

      const submitButton = screen.getByTestId('submit-edit-prompt-button');
      fireEvent.click(submitButton);

      expect(mockUpdatePrompt).toHaveBeenCalledWith({
        id: mockUpdatedPrompt.id,
        title: mockUpdatedPrompt.title,
        summary: mockUpdatedPrompt.summary,
        description: mockUpdatedPrompt.description,
        instructions: mockUpdatedPrompt.instructions,
        example: mockUpdatedPrompt.example,
        model: mockUpdatedPrompt.config.model,
        randomness: mockUpdatedPrompt.config.randomness,
        repetitiveness: mockUpdatedPrompt.config.repetitiveness,
        tags: mockUpdatedPrompt.tags,
      },
        expect.objectContaining({
          onSuccess: expect.any(Function),
          onError: expect.any(Function),
        })
      );

      await waitFor(() => {
        expect(notifications.show).toHaveBeenCalledWith({
          id: 'update-prompt',
          title: 'Failed to Update Prompt',
          message: 'Unable to save your changes. Please try again later.',
          autoClose: false,
          withCloseButton: true,
          icon: <IconX />,
          variant: 'failed_operation',
        });
      });
    });

    it('should call getPromptTagSuggestions when IconSparkles is clicked', async () => {
      render(<EditPromptForm prompt={mockPrompt} />);

      const icon = screen.getByTestId('prompt-tag-suggestion-icon');
      await waitFor(async () => {
        fireEvent.click(icon);
      });

      expect(mockGetPromptTagSuggestion).toHaveBeenCalled();
    });

    it('should render PromptTagSuggestionContainer when getPromptTagSuggestions returns empty array', async () => {
      mockGetPromptTagSuggestion.mockImplementation((_data, { onSuccess }) => {
        onSuccess({ tags: [] });
      });

      render(<EditPromptForm prompt={mockPrompt} />);

      expect(screen.queryByTestId('prompt-tag-suggestion-container')).not.toBeInTheDocument();
      const icon = screen.getByTestId('prompt-tag-suggestion-icon');
      await waitFor(async () => {
        fireEvent.click(icon);
      });

      expect(screen.queryByTestId('prompt-tag-suggestion-container')).toBeInTheDocument();
    });

    it('should not render PromptTagSuggestionContainer when IconSparkles is clicked without valid form', async () => {
      render(<EditPromptForm prompt={mockPrompt} />);

      expect(screen.queryByTestId('prompt-tag-suggestion-container')).not.toBeInTheDocument();

      fireEvent.change(screen.getByLabelText('Title'), { target: { value: '' } });

      const icon = screen.getByTestId('prompt-tag-suggestion-icon');
      await waitFor(() => {
        fireEvent.click(icon);
      });

      expect(mockGetPromptTagSuggestion).not.toHaveBeenCalled();
      expect(screen.queryByTestId('prompt-tag-suggestion-container')).not.toBeInTheDocument();
    });

    it('should display error notification if getPromptTagSuggestions fails', async () => {
      mockGetPromptTagSuggestion.mockImplementation((_data, { onError }) => {
        onError('Failed to get suggestions');
      });

      render(<EditPromptForm prompt={mockPrompt} />);

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
  });
});
