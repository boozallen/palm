import { render, screen } from '@testing-library/react';
import { ComplianceStatus } from '@/features/ai-agents/types/certa/webPolicyCompliance';
import Badge from './Badge';

describe('Badge', () => {
  it.each([
    [ComplianceStatus.Yes, 'Compliant'],
    [ComplianceStatus.LeanYes, 'Lean Compliant'],
    [ComplianceStatus.LeanNo, 'Lean Not Compliant'],
    [ComplianceStatus.No, 'Not Compliant'],
    [ComplianceStatus.VeryUnclear, 'Very unsure'],
  ])('displays correct badge for result: %s', (input, expectedText) => {
    render(<Badge isLoading={false} result={input} />);
    expect(screen.getByText(expectedText)).toBeInTheDocument();
  });

  it('defaults to VeryUnclear for invalid results', () => {
    render(
      <Badge
        isLoading={false}
        result={ComplianceStatus.VeryUnclear}
      />
    );
    expect(screen.getByText('Very unsure')).toBeInTheDocument();
  });

  it('renders loading skeleton', () => {
    render(
      <Badge
        isLoading={true}
        result={ComplianceStatus.Yes}
      />
    );
    expect(
      screen.getByTestId('loading-spinner')
    ).toBeInTheDocument();
  });

  it('renders nothing if neither loading or result is provided', () => {
    const { container } = render(
      <Badge isLoading={false} result={undefined} />
    );
    expect(container).toBeEmptyDOMElement();
  });
});
