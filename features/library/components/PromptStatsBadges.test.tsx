import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PromptStatsBadges from './PromptStatsBadges';

describe('<PromptStatsBadges />', () => {
  it('should render bookmark and usage badges when stats are provided', () => {
    const stats = { bookmarkCount: 5, usageCount: 10 };
    const { getByText } = render(<PromptStatsBadges stats={stats} />);
    
    expect(getByText('5')).toBeInTheDocument();
    expect(getByText('10')).toBeInTheDocument();
  });

  it('should render only bookmark badge when only bookmarkCount is greater than 0', () => {
    const stats = { bookmarkCount: 3, usageCount: 0 };
    const { getByText, queryByText } = render(<PromptStatsBadges stats={stats} />);
    
    expect(getByText('3')).toBeInTheDocument();
    expect(queryByText('0')).not.toBeInTheDocument();
  });

  it('should render only usage badge when only usageCount is greater than 0', () => {
    const stats = { bookmarkCount: 0, usageCount: 7 };
    const { getByText, queryByText } = render(<PromptStatsBadges stats={stats} />);
    
    expect(getByText('7')).toBeInTheDocument();
    expect(queryByText('0')).not.toBeInTheDocument();
  });

  it('should return null when both counts are 0', () => {
    const stats = { bookmarkCount: 0, usageCount: 0 };
    const { container } = render(<PromptStatsBadges stats={stats} />);
    
    expect(container.firstChild).toBeNull();
  });

  it('should render badges with correct icons', () => {
    const stats = { bookmarkCount: 2, usageCount: 4 };
    const { container } = render(<PromptStatsBadges stats={stats} />);
    
    // Check that icons are rendered (Tabler icons have specific SVG structure)
    const svgElements = container.querySelectorAll('svg');
    expect(svgElements).toHaveLength(2);
  });

  it('should show correct tooltip text for bookmark count', async () => {
    const stats = { bookmarkCount: 1, usageCount: 0 };
    const { getByText, findByRole } = render(<PromptStatsBadges stats={stats} />);
    
    const badge = getByText('1').closest('[role]') || getByText('1').parentElement;
    await userEvent.hover(badge!);
    
    expect(await findByRole('tooltip')).toHaveTextContent('Bookmarked by 1 user');
  });

  it('should show correct tooltip text for multiple bookmarks', async () => {
    const stats = { bookmarkCount: 3, usageCount: 0 };
    const { getByText, findByRole } = render(<PromptStatsBadges stats={stats} />);
    
    const badge = getByText('3').closest('[role]') || getByText('3').parentElement;
    await userEvent.hover(badge!);
    
    expect(await findByRole('tooltip')).toHaveTextContent('Bookmarked by 3 users');
  });

  it('should show correct tooltip text for single usage count', async () => {
    const stats = { bookmarkCount: 0, usageCount: 1 };
    const { getByText, findByRole } = render(<PromptStatsBadges stats={stats} />);
    
    const badge = getByText('1').closest('[role]') || getByText('1').parentElement;
    await userEvent.hover(badge!);
    
    expect(await findByRole('tooltip')).toHaveTextContent('Chatted with 1 time');
  });

  it('should show correct tooltip text for multiple usage count', async () => {
    const stats = { bookmarkCount: 0, usageCount: 5 };
    const { getByText, findByRole } = render(<PromptStatsBadges stats={stats} />);
    
    const badge = getByText('5').closest('[role]') || getByText('5').parentElement;
    await userEvent.hover(badge!);
    
    expect(await findByRole('tooltip')).toHaveTextContent('Chatted with 5 times');
  });
});