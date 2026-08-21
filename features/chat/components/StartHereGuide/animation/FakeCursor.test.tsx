import { renderWrapper } from '@/test/test-utils';
import { screen } from '@testing-library/react';

import FakeCursor from './FakeCursor';

describe('FakeCursor', () => {
  it('renders an aria-hidden cursor positioned via transform', () => {
    renderWrapper(<FakeCursor x={10} y={20} />);
    const cursor = screen.getByTestId('fake-cursor');
    expect(cursor).toHaveAttribute('aria-hidden', 'true');
    expect(cursor.style.transform).toContain('translate(10px, 20px)');
  });

  it('applies a clicking transform when clicking is true', () => {
    renderWrapper(<FakeCursor x={0} y={0} clicking />);
    const cursor = screen.getByTestId('fake-cursor');
    expect(cursor.style.transform).toContain('scale(0.8)');
  });
});
