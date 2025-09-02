import React from 'react';
import { render, screen } from '@testing-library/react';

import AccordionItem from './AccordionItem';
import { ResearchPaper } from '@/features/ai-agents/types/radar/researchAgent';

type AccordionItemProps = { value: string; children: React.ReactNode };
type AccordionControlProps = { children: React.ReactNode };
type AccordionPanelProps = { children: React.ReactNode };

jest.mock('@mantine/core', () => {
  const originalModule = jest.requireActual('@mantine/core');

  return {
    ...originalModule,
    Accordion: {
      ...originalModule.Accordion,
      Item: function MockItem(props: AccordionItemProps) {
        return <div data-testid={`accordion-item-${props.value}`}>{props.children}</div>;
      },
      Control: function MockControl(props: AccordionControlProps) {
        return <div data-testid='accordion-control'>{props.children}</div>;
      },
      Panel: function MockPanel(props: AccordionPanelProps) {
        return <div data-testid='accordion-panel'>{props.children}</div>;
      },
    },
  };
});

describe('AccordionItem Component', () => {
  const mockPaper: ResearchPaper = {
    id: 'https://arxiv.org/abs/1234.5678',
    updated: '2023-05-15',
    published: '2023-05-15',
    title: 'Transformer Architecture for NLP',
    summary: 'This is a sample abstract about transformers.',
    authors: ['Author One', 'Author Two'],
    institutions: ['Stanford University', 'MIT'],
    categories: [
      'Natural Language Processing',
      'Artificial Intelligence',
    ],
  };

  it('renders the paper title and metadata in the control section', () => {
    render(<AccordionItem paper={mockPaper} index={0} />);

    expect(screen.getByText('Transformer Architecture for NLP')).toBeInTheDocument();
    expect(screen.getByText('#1')).toBeInTheDocument();
    expect(screen.getByText('Natural Language Processing')).toBeInTheDocument();
    expect(screen.getByText('Artificial Intelligence')).toBeInTheDocument();
    expect(screen.getByText('Author One, Author Two • 5/15/2023')).toBeInTheDocument();
  });

  it('renders paper details in the panel section', () => {
    render(<AccordionItem paper={mockPaper} index={0} />);

    expect(screen.getByText('Institutions:')).toBeInTheDocument();
    expect(screen.getByText('Stanford University')).toBeInTheDocument();
    expect(screen.getByText('MIT')).toBeInTheDocument();

    expect(screen.getByText('ArXiv Categories:')).toBeInTheDocument();
    expect(screen.getByText('Natural Language Processing, Artificial Intelligence')).toBeInTheDocument();

    expect(screen.getByText('Abstract:')).toBeInTheDocument();
    expect(screen.getByText('This is a sample abstract about transformers.')).toBeInTheDocument();

    expect(screen.getByText('View on arXiv')).toBeInTheDocument();
    const viewButton = screen.getByText('View on arXiv');
    expect(viewButton.closest('a')).toHaveAttribute('href', 'https://arxiv.org/abs/1234.5678');
  });

  it('displays "et al." for papers with more than 3 authors', () => {
    const manyAuthorsPaper: ResearchPaper = {
      ...mockPaper,
      authors: ['Author One', 'Author Two', 'Author Three', 'Author Four', 'Author Five'],
    };

    render(<AccordionItem paper={manyAuthorsPaper} index={0} />);

    expect(screen.getByText('Author One, Author Two, Author Three et al. • 5/15/2023')).toBeInTheDocument();
  });

  it('handles papers with a single category', () => {
    const singleCategoryPaper: ResearchPaper = {
      ...mockPaper,
      categories: ['Robotics'], 
    };

    render(<AccordionItem paper={singleCategoryPaper} index={0} />);

    expect(screen.getAllByText('Robotics')).toHaveLength(2);
    expect(screen.queryByText('Natural Language Processing')).not.toBeInTheDocument();
    expect(screen.queryByText('Artificial Intelligence')).not.toBeInTheDocument();
  });

  it('handles papers with no categories by showing empty categories', () => {
    const noCategoriesPaper: ResearchPaper = {
      ...mockPaper,
      categories: [],
    };

    render(<AccordionItem paper={noCategoriesPaper} index={0} />);

    expect(screen.queryByText('Natural Language Processing')).not.toBeInTheDocument();
    expect(screen.queryByText('Artificial Intelligence')).not.toBeInTheDocument();
    expect(screen.queryByText('cs.CL, cs.AI')).not.toBeInTheDocument();
    expect(screen.getByText('ArXiv Categories:')).toBeInTheDocument();
  });
});
