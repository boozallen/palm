import { render, fireEvent } from '@testing-library/react';
import PromptViewToggle from './PromptViewToggle';

describe('<PromptViewToggle />', () => {
  const mockTogglePromptsView = jest.fn();

  it('should render both toggle buttons', () => {
    const { getByLabelText } = render(
      <PromptViewToggle isTableView={true} togglePromptsView={mockTogglePromptsView} />
    );

    expect(getByLabelText('Table view')).toBeInTheDocument();
    expect(getByLabelText('Card view')).toBeInTheDocument();
  });

  it('should call togglePromptsView with true when Table view button is clicked', () => {
    const { getByLabelText } = render(
      <PromptViewToggle isTableView={false} togglePromptsView={mockTogglePromptsView} />
    );

    fireEvent.click(getByLabelText('Table view'));
    expect(mockTogglePromptsView).toHaveBeenCalledWith(true);
  });

  it('should call togglePromptsView with false when Card view button is clicked', () => {
    const { getByLabelText } = render(
      <PromptViewToggle isTableView={true} togglePromptsView={mockTogglePromptsView} />
    );

    fireEvent.click(getByLabelText('Card view'));
    expect(mockTogglePromptsView).toHaveBeenCalledWith(false);
  });
});
