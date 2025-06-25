import { AccordionVariant } from '@mantine/core/lib/Accordion/Accordion.types';

type ExtendedAccordionVariant = AccordionVariant | 'instructions_and_parameters';

declare module '@mantine/core' {
  export interface AccordionProps {
    variant?: ExtendedAccordionVariant;
  }
}
