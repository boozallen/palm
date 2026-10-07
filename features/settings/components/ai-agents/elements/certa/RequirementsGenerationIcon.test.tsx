import RequirementsGenerationIcon from './RequirementsGenerationIcon';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

describe('PromptTagSuggestionIcon', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const handleClick = jest.fn();

  it('should display tooltip when form is valid and IconSparkles is hovered on', async () => {
    render(<RequirementsGenerationIcon disabled={false} isLoading={false} onClick={handleClick} />);

    await userEvent.hover(screen.getByLabelText('Generate requirements'));

    await waitFor(() => {
      expect(screen.getByText('Generate requirements from policy content')).toBeInTheDocument();
    });
  });

  it('should call onClick when form is valid and IconSparkles is clicked', async () => {
    render(<RequirementsGenerationIcon disabled={false} isLoading={false} onClick={handleClick} />);

    const icon = screen.getByLabelText('Generate requirements');
    await userEvent.click(icon);

    expect(handleClick).toHaveBeenCalled();
  });

  it('should disable IconSparkles when form is not valid', async () => {
    render(<RequirementsGenerationIcon disabled={true} isLoading={false} onClick={handleClick} />);

    const icon = screen.getByLabelText('Generate requirements');

    expect(icon).toBeDisabled();
  });
});
