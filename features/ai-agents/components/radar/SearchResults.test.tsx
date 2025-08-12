import React from 'react';
import { render, screen } from '@testing-library/react';

import SearchResults from './SearchResults';

describe('SearchResults Component', () => {
  const mockStats = {
    totalResults: 10,
    totalInstitutions: 5,
    categories: {
      'Artificial Intelligence': 4,
      'Natural Language Processing': 3,
      'Computer Vision': 2,
      'Machine Learning': 1,
    },
  };

  it('renders the search results header and paper count', () => {
    render(<SearchResults {...mockStats} />);

    expect(screen.getByText('Search Results')).toBeInTheDocument();
    expect(screen.getByText('10 papers found')).toBeInTheDocument();
  });

  it('displays the correct stats', () => {
    render(<SearchResults {...mockStats} />);

    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('displays the category badges with mapped names', () => {
    render(<SearchResults {...mockStats} />);

    expect(screen.getByText('Artificial Intelligence: 4')).toBeInTheDocument();
    expect(screen.getByText('Natural Language Processing: 3')).toBeInTheDocument();
    expect(screen.getByText('Computer Vision: 2')).toBeInTheDocument();
    expect(screen.getByText('Machine Learning: 1')).toBeInTheDocument();
  });

  it('does not display categories if there are no papers', () => {
    const emptyStats = { ...mockStats, totalResults: 0, categories: {} };
    render(<SearchResults {...emptyStats} />);

    expect(screen.queryByText('Research Categories')).not.toBeInTheDocument();
  });

  it('uses singular if only one paper is returned', () => {
    const emptyStats = { ...mockStats, totalResults: 1 };
    render(<SearchResults {...emptyStats} />);

    expect(screen.queryByText('1 paper found')).toBeInTheDocument();
  });
});
