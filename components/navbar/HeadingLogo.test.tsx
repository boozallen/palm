import HeadingLogo from '@/components/navbar/HeadingLogo';
import { render } from '@testing-library/react';

describe('Describe the Headding Ribbon', () => {
  it('should render BA-PALM logo', () => {
    const { getByTestId } = render(
      <HeadingLogo />
    );

    const logo = getByTestId('logo');
    expect(logo).toBeInTheDocument();
  });
});
