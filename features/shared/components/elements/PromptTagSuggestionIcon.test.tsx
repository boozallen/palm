import PromptTagSuggestionIcon from '@/features/shared/components/elements/PromptTagSuggestionIcon';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('PromptTagSuggestionIcon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const handleClick = jest.fn();

  it('should display tooltip when form is valid and IconSparkles is hovered on', async () => {
    render(<PromptTagSuggestionIcon enabled={true} isLoading={false} onClick={handleClick} />);

    await userEvent.hover(screen.getByTestId('prompt-tag-suggestion-icon'));

    await waitFor(() => {
      expect(screen.getByText('Generate a list of recommended tags based on the content of your prompt')).toBeInTheDocument();
    });
  });

  it('should call onClick when form is valid and IconSparkles is clicked', async () => {
    render(<PromptTagSuggestionIcon enabled={true} isLoading={false} onClick={handleClick} />);

    const icon = screen.getByTestId('prompt-tag-suggestion-icon');
    await userEvent.click(icon);

    expect(handleClick).toHaveBeenCalled();
  });

  it('should disable IconSparkles when form is not valid', async () => {
    render(<PromptTagSuggestionIcon enabled={false} isLoading={false} onClick={handleClick} />);

    const icon = screen.getByTestId('prompt-tag-suggestion-icon');

    expect(icon).toBeDisabled();
  });
});
