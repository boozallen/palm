import React from 'react';
import { render, screen } from '@testing-library/react';

import Accordion from './Accordion';
import { ResearchPaper } from '@/features/ai-agents/types/radar/researchAgent';

jest.mock('./AccordionItem', () => {
  return {
    __esModule: true,
    default: function MockAccordionItem(props: {
      paper: ResearchPaper;
      index: number;
    }) {
      return (
        <div data-testid={`accordion-item-${props.index}`}>
          {props.paper.title}
        </div>
      );
    },
  };
});

describe('Accordion Component', () => {
  const mockPapers: ResearchPaper[] = [
    {
      id: 'https://arxiv.org/abs/1234.5678',
      updated: '2023-05-15',
      published: '2023-05-15',
      title: 'Transformer Architecture for NLP',
      summary: 'This is a sample abstract about transformers.',
      authors: ['Author One', 'Author Two'],
      institutions: ['Stanford University', 'MIT'],
      categories: ['cs.CL', 'cs.AI'],
    },
    {
      id: 'https://arxiv.org/abs/8765.4321',
      updated: '2023-04-10',
      published: '2023-04-10',
      title: 'Deep Learning in Computer Vision',
      summary: 'This is a sample abstract about computer vision.',
      authors: ['Author Three', 'Author Four', 'Author Five', 'Author Six'],
      institutions: ['Google AI', 'DeepMind'],
      categories: ['cs.CV', 'cs.LG'],
    },
  ];

  it('renders the title and correct number of accordion items', () => {
    render(<Accordion papers={mockPapers} />);

    expect(screen.getByText('Research Papers')).toBeInTheDocument();
    expect(screen.getByTestId('accordion-item-0')).toBeInTheDocument();
    expect(screen.getByTestId('accordion-item-1')).toBeInTheDocument();
    expect(screen.queryByTestId('accordion-item-2')).not.toBeInTheDocument();
  });

  it('passes the correct props to each AccordionItem', () => {
    render(<Accordion papers={mockPapers} />);

    expect(
      screen.getByText('Transformer Architecture for NLP')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Deep Learning in Computer Vision')
    ).toBeInTheDocument();
  });

  it('renders nothing when papers array is empty', () => {
    const { container } = render(<Accordion papers={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
