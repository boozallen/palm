import { Prompt } from '@/features/shared/types';
import { AiSettings } from '@/types';

export const prompts: Prompt[] = [
  {
    id: 'research-analysis',
    creatorId: null,
    title: 'Research Analysis',
    summary: 'Analyzes research papers for institutional insights and research trends',
    description: 'Performs comprehensive analysis of academic research papers to identify research trends, institutional capabilities, and technology developments',
     instructions: `You are a senior research analyst providing comprehensive insights on global research developments. Analyze this dataset of {req.paperCount} research papers from the period {req.timeframe}.


**Research Overview:**
{req.contextSummary}

**Dataset Summary:**
- Total papers analyzed: {req.paperCount}
- Primary institutions: {req.topInstitutions}
- Research domains: {req.topCategories}

**Research Domain Distribution:**
{req.categoryDistribution}

**Institutional Research Profiles:**
{req.institutionInsights}

**Notable Research Papers ({req.notablePaperCount} selected for detailed analysis):**
{req.notableSummaries}

**Analysis Framework:**
Provide a comprehensive analysis that senior leadership can use for research assessment and technology planning. Focus on:

## Executive Summary
Begin your Executive Summary by stating: "The dataset of {req.paperCount} research papers from {req.timeframe} highlights..."
Provide a 4-5 sentence overview highlighting the most significant research developments, institutional strengths, and technological trends that emerge from this research portfolio.

### Research Landscape Analysis
1. **Primary Research Directions**: What are the dominant research themes and methodological approaches being pursued?
2. **Emerging Technologies**: What novel technological developments or research methodologies are being explored?
3. **Research Evolution**: How do current research priorities reflect broader technological and scientific trends?

### Technology Development Insights
1. **Innovation Highlights**: Most significant technical advances, breakthrough methodologies, or novel research approaches
2. **Practical Applications**: Research showing potential for real-world implementation or commercial application
3. **Technical Sophistication**: Assessment of the advancement level and complexity of the research methodologies and results

### Institutional Capabilities Assessment
1. **Leading Research Centers**: Which institutions demonstrate the strongest research output and technical depth in key areas?
2. **Research Specializations**: What unique expertise, focus areas, or methodological strengths does each major institution demonstrate?
3. **Collaborative Networks**: Evidence of research partnerships, joint publications, or coordinated research efforts

### Research Impact Assessment
1. **Breakthrough Potential**: Research that could significantly advance the field or enable new technological capabilities
2. **Knowledge Advancement**: Contributions to fundamental understanding in key technology domains
3. **Implementation Readiness**: Work that appears closest to practical deployment or technology transfer

### Technology Assessment
1. **Research Investment Patterns**: What do publication volumes and focus areas reveal about institutional priorities and resource allocation?
2. **Capability Development Trends**: Areas where sustained research effort is building significant institutional expertise
3. **Technology Advancement Trajectory**: Assessment of research progression and likely future development directions
4. **Research Ecosystem Strength**: Overall assessment of the research environment's capacity for continued innovation

### Key Findings & Implications
1. **Research Strengths**: Areas where this research portfolio demonstrates particular depth, innovation, or technical advancement
2. **Technology Readiness**: Assessment of how close various research areas are to practical application or commercialization
3. **Institutional Development**: Evidence of growing research capabilities, emerging centers of excellence, or shifting research focus
4. **Future Research Directions**: Likely next steps and emerging research trajectories based on current work patterns
5. **Technology Transfer Opportunities**: Research with clear potential for practical application, industry collaboration, or commercialization

**Important Guidelines:**
- When referencing specific research papers, always use the full paper title in quotes (e.g., "Full Paper Title")
- Never use ArXiv category codes like cs.CV, cs.LG, etc. - always use the full readable category names like "Computer Vision" and "Machine Learning"
- Focus on technological capabilities, research quality, and institutional strengths rather than competitive positioning
- Provide specific examples and concrete observations from the research papers
- Consider both immediate applications and long-term research implications
- Maintain an objective, analytical tone focused on research assessment and technology development

This analysis will inform understanding of current research capabilities, institutional strengths, technology development trends, and potential opportunities for collaboration or investment within this research portfolio.`,
    tags: ['research', 'analysis', 'institutional', 'technology-assessment'],
    example: '',
    config: {} as AiSettings,
  },
];
