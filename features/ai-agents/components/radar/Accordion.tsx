import { Paper, Title, Accordion as MAccordion  } from '@mantine/core';

import { ResearchPaper } from '@/features/ai-agents/types/radar/researchAgent';
import AccordionItem from './AccordionItem';

type AccordionProps = Readonly<{
  papers: ResearchPaper[];
}>;

export default function Accordion({ papers }: AccordionProps) {
  if (!papers.length) {
    return null;
  }

  return (
    <Paper p='md' withBorder>
      <Title order={2} fw='bolder' mb='md'>Research Papers</Title>
      <MAccordion variant='separated' chevronPosition='right'>
        {papers.map((paper, index) => (
          <AccordionItem 
            key={paper.id} 
            paper={paper} 
            index={index} 
          />
        ))}
      </MAccordion>
    </Paper>
  );
}
