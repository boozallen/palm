import { render, screen } from '@testing-library/react';

import General from './General';

jest.mock('./tables/UiPreferencesTable', () => {
  return function MockUiPreferencesTable() {
    return <div>UI Preferences Table</div>;
  };
});

describe('General', () => {

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the title', () => {
    render(<General />);

    const title = screen.getByText('General Settings');
    expect(title).toBeInTheDocument();
  });

  it('renders UiPreferencesTable', () => {
    render(<General />);

    expect(screen.getByText('UI Preferences Table')).toBeInTheDocument();
  });
});