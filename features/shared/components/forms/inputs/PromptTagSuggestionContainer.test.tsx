import { render, screen, fireEvent } from '@testing-library/react';

import PromptTagSuggestionContainer from './PromptTagSuggestionContainer';

describe('PromptTagSuggestionContainer', () => {

  const noTagsMessage = 'No tags suggested.';
  const hasTagsMessage =
    'Based on the contents of your prompt, we recommend the following tags. Choosing \'Accept\' will replace the current tags in the input.';

  const mockTags = ['example-tag'];

  const mockOnAccept = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with tags', () => {
    render(<PromptTagSuggestionContainer tags={mockTags} onAccept={mockOnAccept} onClose={mockOnClose} />);

    expect(screen.getByTestId('prompt-tag-suggestion-container')).toBeInTheDocument();
    expect(screen.getByText(hasTagsMessage)).toBeInTheDocument();
    expect(screen.getByText('Accept')).toBeInTheDocument();
    expect(screen.getByText('Ignore')).toBeInTheDocument();
    expect(screen.queryByText('Close')).not.toBeInTheDocument();
    expect(screen.getByText('example-tag')).toBeInTheDocument();
  });

  it('renders correctly without tags', () => {
    render(<PromptTagSuggestionContainer tags={[]} onAccept={mockOnAccept} onClose={mockOnClose} />);

    expect(screen.getByTestId('prompt-tag-suggestion-container')).toBeInTheDocument();
    expect(screen.getByText(noTagsMessage)).toBeInTheDocument();
    expect(screen.queryByText('Accept')).not.toBeInTheDocument();
    expect(screen.queryByText('Ignore')).not.toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('calls onAccept when Accept button is clicked', () => {
    render(<PromptTagSuggestionContainer tags={mockTags} onAccept={mockOnAccept} onClose={mockOnClose} />);

    const acceptButton = screen.getByText('Accept');
    fireEvent.click(acceptButton);

    expect(mockOnAccept).toHaveBeenCalled();
  });

  it('calls onClose when Ignore button is clicked', () => {
    render(<PromptTagSuggestionContainer tags={mockTags} onAccept={mockOnAccept} onClose={mockOnClose} />);

    const ignoreButton = screen.getByText('Ignore');
    fireEvent.click(ignoreButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls onClose when no tags and Close button is clicked', () => {
    render(<PromptTagSuggestionContainer tags={[]} onAccept={mockOnAccept} onClose={mockOnClose} />);

    const closeButton = screen.getByText('Close');
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

});
