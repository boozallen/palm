import { Prompt } from '@/features/shared/types';
import { AiSettings } from '@/types';

export const compliancePrompts: Prompt[] = [
  {
    id: 'summarize-policy',
    creatorId: null,
    title: 'Policy Summarization',
    summary: 'Generates a concise summary of a complex policy document',
    description: 'Takes a policy document and creates a 16-word or less summary capturing the essential requirements',
    instructions: `You are a world-class expert in capturing the essentials of a complex policy with a single-sentence summary. Below you will see a FULL POLICY. Your task is to output the short version of this policy, in 16 words or fewer.
    FULL POLICY:
    {req.policy}
    Only output the summary, no additional text.`,
    tags: [],
    example: '',
    config: {} as AiSettings,
  },
  {
    id: 'consensus-check',
    creatorId: null,
    title: 'Consensus Analysis',
    summary: 'Analyzes multiple compliance reviews for consensus',
    description: 'Evaluates multiple compliance reviews to identify areas of agreement',
    instructions: `MANDATORY OUTPUT FORMAT:
    1. First line MUST be a fresh summary of the compliance status
    2. No references to previous analysis, original answers, or additional context
    3. No comparisons to other findings
    4. No commentary about changes or updates
    Follow this format EXACTLY, starting with the summary line:
    Write a one-paragraph summary of the overall compliance status, followed by:
    requirement,status,evidence_text,evidence_location,explanation
    [Requirements list]
    Remediation Steps: (if needed)
    [Numbered steps]
    Input Data to Analyze:
    POLICY SUMMARY:
    {req.summary}
    REVIEW SET:
    {req.input1}
    {req.input2}
    {req.input3}
    Analysis Steps:
    1. READ THESE INSTRUCTIONS CAREFULLY:
      - You must start with a fresh summary
      - Do not mention or compare to any previous analysis
      - Do not reference original answers
      - Do not discuss additional context
      - Do not add commentary about changes
    2. Analyze the review set:
      - 'Ensure that the requirements match the policy requirements' 
      - Ensure that the requirements match the policy requirements
      - Count agreements (need 2+ matches)
      - Use most detailed evidence found
      - Combine similar remediation items
    Example Output Structure (Hypothetical):
    Multiple reviews confirm strong FOIA compliance while identifying consistent gaps in privacy policy implementation. Navigation structure meets basic requirements but needs enhancement for accessibility.
    requirement,status,evidence_text,evidence_location,explanation
    "FOIA Implementation",Met,"FOIA Portal",Global Nav,"Consistently verified across reviews"
    "Privacy Policy",Not Met,"No policy found","None","Agreement on missing requirements"
    Remediation Steps:
    1. Implement privacy policy (90 days)
    2. Add to global navigation (30 days)`,
    example: '',
    tags: [],
    config: {} as AiSettings,
  },
  {
    id: 'compliance-check', 
    creatorId: null,
    title: 'Compliance Check',
    summary: 'Evaluates website content against policy requirements',
    description: 'Analyzes website content for compliance with specified policy requirements',
    instructions: `IMPORTANT: START YOUR RESPONSE WITH THE COMPLIANCE SUMMARY. DO NOT REFER TO ANY PREVIOUS ANALYSIS, ORIGINAL FINDINGS, OR ADDITIONAL CONTEXT.
    Role: You are CERTA, a compliance evaluation, reporting and tracking agent. Your task is to perform a new, standalone compliance check of the provided website content. Assume that the provided policy requirements apply to the website being evaluated unless otherwise instructed.
    Input Data:
    1. Complete website content snapshot (including all pages, headers, footers, navigation)
    2. Policy content
    3. Policy requirements
    4. Policy summary
    POLICY CONTENT:
    {req.content}
    POLICY REQUIREMENTS:
    {req.requirements}
    POLICY SUMMARY:
    {req.summary}
    -----------------------------
    REQUIREMENT INTERPRETATION GUIDELINES:
    1. Primary Requirements:
      - Assume the provided input is the complete set of policy requirements
      - If the input is a clearly formatted list (e.g., numbered or bulleted), treat each item as an independent requirement
      - If the input is unstructured or in paragraph form do the following:
        - Scan the text for explicit markers like "must", "needs", or similar key phrases to identify requirements
        - Break down the text using natural language heuristics to derive atomic requirements
    2. Do not introduce new requirements or sub-requirements
    3. **Preserve Original Wording:** Return each identified requirement verbatim without modifying the language
    -----------------------------
    EXAMPLES (few-shot style for reference):
    [Example A1: Standard Link Requirement]
    [Policy Requirements]
    "About page is present. Link to about page exists in main navigation or footer"
    [Input HTML]
    <div class="site-footer">
      <div class="footer-menu">
        <a href="/about">About</a>
      </div>
    </div>
    [Expected Output]
    requirement,status,evidence_text,evidence_location,explanation
    "About page is present",Met,"/about","Footer menu","About route exists"
    "Link to about page exists in main navigation or footer",Met,"/about","Footer menu","Link present in footer"
    [Example A2: Missing Requirement]
    [Policy Requirements]
    "Required page is present. Link to required page exists in main navigation or footer. Required page lists sponsors"
    [Input HTML]
    <nav>
      <a href="/page">Required Page</a>
    </nav>
    <div id="content">
      <p>Some content here...</p>
    </div>
    [Expected Output]
    requirement,status,evidence_text,evidence_location,explanation
    "Required page is present",Met,"Link to required page exists","Main content","Required page is present."
    "Link to required page exists in main navigation or footer",Met,"Link to required page exists","Main content","Required page is present."
    "Required page lists sponsors",Not Met,"Content needs review","Main content","Required page does not list sponsors."
    -----------------------------
    ComplianceBot Analysis Protocol:
    1. Read Policy Requirements Carefully:
      - Focus on "What Do I Need To Do To Comply?" sections
      - Note all "must" statements
      - Document implementation timeframes
    2. Website Evaluation:
      - CRITICAL: Before marking "Not met":
        1. Check ALL possible locations systematically
        2. Look for alternative names/variations
        3. Consider related content/links
      - Never assume missing without full check
      - Website type should not affect evaluation
      - Use "Partially met" for existing but incomplete
      - Keep link and content requirements separate
      - Document exact evidence location
    START YOUR RESPONSE WITH A COMPLIANCE SUMMARY PARAGRAPH.
    Then use EXACTLY this format:
    requirement,status,evidence_text,evidence_location,explanation
    [Requirements list in CSV format]
    Remediation Steps:
    [Numbered list if needed]`,
    example: '',
    tags: [],
    config: {} as AiSettings,
  },
];

export const researchAnalysisPrompts: Prompt[] = [
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
