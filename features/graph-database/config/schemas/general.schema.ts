import { ANY_TYPE, type GraphSchema } from './types';

/**
 * The default extraction schema. Reproduces today's hardcoded vocabulary:
 * the `EntityType` / `ConceptCategory` enums and `KNOWN_RELATIONSHIP_TYPES`.
 *
 * This is the flag-ON "General" selection. (Flag-OFF does NOT use this file —
 * the legacy extraction path in `entityExtractor.ts` is preserved byte-for-byte;
 * this schema only needs behavior-equivalence, not byte-identity.)
 */
export const general: GraphSchema = {
  key: 'general',
  name: 'General',
  description:
    'General-purpose extraction across people, organizations, locations, technologies, products, dates, and documents.',
  nodeTypes: [
    {
      type: 'PERSON',
      description:
        'A named individual. Always use the full name including surname when available; place first names and nicknames in aliases.',
      examples: ['Jon Noronha', 'John Smith'],
    },
    {
      type: 'ORGANIZATION',
      description:
        'A company, agency, institution, or other formal organization. Use the full official name; place acronyms and abbreviations in aliases.',
      examples: ['Defense Health Agency', 'Amazon Web Services'],
    },
    {
      type: 'LOCATION',
      description: 'A geographic place — country, state, city, region, facility, or address.',
      examples: ['Washington, D.C.', 'San Francisco'],
    },
    {
      type: 'TECHNOLOGY',
      description: 'A technology, platform, framework, method, or technical system.',
      examples: ['Azure', 'Machine Learning', 'Kubernetes'],
    },
    {
      type: 'PRODUCT',
      description: 'A named product, service, or offering.',
      examples: ['iPhone', 'Microsoft Office'],
    },
    {
      type: 'DATE',
      description: 'A specific date, time period, or temporal reference.',
      examples: ['January 2026', 'Q3 2025'],
    },
    {
      type: 'DOCUMENT',
      description: 'A law, regulation, standard, memo, or policy.',
      examples: ['HIPAA', 'FAR Part 15'],
    },
  ],
  conceptCategories: ['TECHNICAL', 'BUSINESS', 'DOMAIN_SPECIFIC', 'GENERAL'],
  edgeTypes: [
    // Organizational
    {
      relationType: 'WORKS_FOR',
      description: 'A person is employed by or works for an organization.',
      allowedEndpoints: [['PERSON', 'ORGANIZATION']],
    },
    {
      relationType: 'MANAGES',
      description: 'A person manages another person, team, or entity.',
      allowedEndpoints: [['PERSON', ANY_TYPE]],
    },
    {
      relationType: 'REPORTS_TO',
      description: 'A person reports to another person in an organizational hierarchy.',
      allowedEndpoints: [['PERSON', 'PERSON']],
    },
    {
      relationType: 'MEMBER_OF',
      description: 'A person or entity is a member of an organization or group.',
      allowedEndpoints: [['PERSON', 'ORGANIZATION']],
    },
    // Structural
    {
      relationType: 'PART_OF',
      description: 'An entity is a structural part of a larger entity.',
      allowedEndpoints: [[ANY_TYPE, ANY_TYPE]],
    },
    {
      relationType: 'SUBSIDIARY_OF',
      description: 'An organization is a subsidiary of a parent organization.',
      allowedEndpoints: [['ORGANIZATION', 'ORGANIZATION']],
    },
    {
      relationType: 'DIVISION_OF',
      description: 'An organization or unit is a division of a parent organization.',
      allowedEndpoints: [['ORGANIZATION', 'ORGANIZATION']],
    },
    {
      relationType: 'OWNS',
      description: 'An entity owns another entity.',
      allowedEndpoints: [[ANY_TYPE, ANY_TYPE]],
    },
    // Locational
    {
      relationType: 'LOCATED_IN',
      description: 'An entity is located in a place.',
      allowedEndpoints: [[ANY_TYPE, 'LOCATION']],
    },
    {
      relationType: 'BASED_IN',
      description: 'An organization is based in a location.',
      allowedEndpoints: [['ORGANIZATION', 'LOCATION']],
    },
    {
      relationType: 'OPERATES_IN',
      description: 'An organization operates in a location or market.',
      allowedEndpoints: [['ORGANIZATION', 'LOCATION']],
    },
    // Conceptual
    {
      relationType: 'RELATES_TO',
      description: 'A general association between two entities or concepts.',
      allowedEndpoints: [[ANY_TYPE, ANY_TYPE]],
    },
    {
      relationType: 'REQUIRES',
      description: 'An entity or concept requires another.',
      allowedEndpoints: [[ANY_TYPE, ANY_TYPE]],
    },
    {
      relationType: 'IMPLEMENTS',
      description: 'An entity implements a concept, method, or standard.',
      allowedEndpoints: [[ANY_TYPE, ANY_TYPE]],
    },
    {
      relationType: 'USES',
      description: 'An entity uses a technology, product, or method.',
      allowedEndpoints: [[ANY_TYPE, ANY_TYPE]],
    },
    // Temporal
    {
      relationType: 'SUCCEEDED_BY',
      description: 'An entity is succeeded by another in time.',
      allowedEndpoints: [[ANY_TYPE, ANY_TYPE]],
    },
    {
      relationType: 'PRECEDED_BY',
      description: 'An entity is preceded by another in time.',
      allowedEndpoints: [[ANY_TYPE, ANY_TYPE]],
    },
  ],
};
