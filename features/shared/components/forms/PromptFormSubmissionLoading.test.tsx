import { render } from '@testing-library/react';
import PromptFormSubmissionLoading from './PromptFormSubmissionLoading';

describe('PromptFormSubmissionLoading', () => {
  it('renders correctly', () => {
    const { container } = render(<PromptFormSubmissionLoading />);
    expect(container.firstChild).toHaveClass('mantine-Paper-root');
    expect(container.firstChild?.childNodes).toHaveLength(4);
    container.firstChild?.childNodes.forEach(node => {
      expect(node).toHaveClass('mantine-Skeleton-root');
    });
  });
});
