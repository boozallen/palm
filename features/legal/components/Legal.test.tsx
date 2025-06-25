import { render, screen } from '@testing-library/react';
import Legal from '@/features/legal/components/Legal';

jest.mock('@/features/legal/components/restricted-rights/Policy', () => ({
  __esModule: true,
  default: () => <div data-testid='mock-policy'>Policy</div>,
}));

describe('Legal Component', () => {
  it('renders the Policy component inside the Accordion and Stack', () => {
    render(<Legal />);

    const policy = screen.getByTestId('mock-policy');
    expect(policy).toBeInTheDocument();
  });
});
