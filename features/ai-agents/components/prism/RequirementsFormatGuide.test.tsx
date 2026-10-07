import { render, screen } from '@testing-library/react';

import RequirementsFormatGuide from './RequirementsFormatGuide';

describe('RequirementsFormatGuide', () => {
  it('renders the column structure heading', () => {
    render(<RequirementsFormatGuide />);

    expect(screen.getByText(/Your spreadsheet must follow this column structure/i)).toBeInTheDocument();
  });

  it('renders Requirement column header with Required badge', () => {
    render(<RequirementsFormatGuide />);

    expect(screen.getByRole('columnheader', { name: /requirement/i })).toBeInTheDocument();
    expect(screen.getByText('Required')).toBeInTheDocument();
  });

  it('renders example row with sample requirement', () => {
    render(<RequirementsFormatGuide />);

    expect(screen.getByText(/1,000 concurrent users/i)).toBeInTheDocument();
  });

  it('renders the Requirement column name in the alert', () => {
    render(<RequirementsFormatGuide />);

    expect(screen.getByText(/one column must be named/i)).toBeInTheDocument();
  });

  it('renders info that other columns are allowed', () => {
    render(<RequirementsFormatGuide />);

    expect(screen.getByText(/other columns are allowed/i)).toBeInTheDocument();
  });

  it('renders tab categories info', () => {
    render(<RequirementsFormatGuide />);

    expect(screen.getByText(/each tab name will be used as a category/i)).toBeInTheDocument();
  });
});
