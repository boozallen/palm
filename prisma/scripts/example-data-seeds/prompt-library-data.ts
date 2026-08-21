/**
 * Prompt library seed data.
 *
 * Emulates the production prompt library (Generate a PRD, Itemized PD JSON
 * Creator, Proposal Guardian) with an RFP/RFI focus, swapping the clinical
 * example for an RFI Response Strategist. Each prompt is owned by a user, and
 * badge counts (MOST CHATTED / MOST BOOKMARKED / MOST RECENT) are driven by
 * real Chat and PromptBookmark rows created alongside the prompts.
 *
 * Consumed by prisma/scripts/seed-environment.ts.
 */

// The default model string stored on prompts (display/config only — not an FK).
export const PROMPT_LIBRARY_MODEL = 'us.anthropic.claude-sonnet-4-5-20250929-v1:0';

export interface PromptSeed {
  slug: string;
  title: string;
  summary: string;
  description: string;
  instructions: string;
  example: string;
  tags: string[];
  temperature: number;
  topP: number;
  // 'target' => owned by the user the experience is built around; otherwise the
  // colleague email that owns the prompt.
  owner: 'target' | string;
  // Number of Chat rows to create for this prompt (drives MOST CHATTED). These
  // padding chats are distributed across colleagues so they never clutter the
  // target user's own chat history.
  chatCount: number;
  // Number of distinct users who bookmark this prompt (drives MOST BOOKMARKED).
  bookmarkCount: number;
}

export interface ChatMessageSeed {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatSeed {
  // Prompt this chat is tied to.
  promptSlug: string;
  // 'target' => owned by the target user; otherwise the owning colleague email.
  owner: 'target' | string;
  summary: string;
  messages: ChatMessageSeed[];
}

// Ordered oldest → newest. The last prompt gets the most recent createdAt, so
// it earns the MOST RECENT badge.
export const PROMPT_LIBRARY: PromptSeed[] = [
  {
    slug: 'generate-a-prd',
    title: 'Generate a PRD',
    summary: 'Draft a structured product requirements document from a short brief',
    description:
      'Turns a short capability brief into a structured product requirements document (PRD) with problem statement, goals, user stories, functional and non-functional requirements, and success metrics.',
    instructions: `Persona: You are a senior product manager supporting a federal digital services team. Convert the provided brief into a clear, well-structured Product Requirements Document (PRD).
Rules:
1. Use Markdown headings for each section
2. Include: Problem Statement, Goals & Non-Goals, User Stories, Functional Requirements, Non-Functional Requirements, Success Metrics, and Open Questions
3. Write user stories in the form "As a <role>, I want <capability> so that <benefit>"
4. Keep requirements testable and unambiguous
Brief:
`,
    example:
      'We need a self-service portal where veterans can check the status of a benefits claim, upload supporting documents, and receive notifications when the status changes.',
    tags: ['Product', 'Requirements'],
    temperature: 0.4,
    topP: 0.9,
    owner: 'target',
    chatCount: 3,
    bookmarkCount: 4,
  },
  {
    slug: 'itemized-pd-json-creator',
    title: 'Itemized PD JSON Creator',
    summary: 'Parse a position description into itemized, structured JSON',
    description:
      'Extracts duties, required qualifications, clearances, and labor category signals from a government position description and returns clean, itemized JSON ready for downstream staffing and pricing tools.',
    instructions: `Persona: You are a proposal operations analyst. Parse the provided position description (PD) into structured JSON.
Rules:
1. Return ONLY valid JSON — no prose, no Markdown fences
2. Use this shape: { "title": string, "duties": string[], "requiredQualifications": string[], "preferredQualifications": string[], "clearance": string | null, "laborCategory": string | null, "yearsExperience": number | null }
3. Split compound duties into individual, atomic items
4. Normalize clearance values to one of: "None", "Public Trust", "Secret", "Top Secret", "TS/SCI"
Position Description:
`,
    example:
      'Senior Data Engineer — Designs and maintains data pipelines, mentors junior engineers, and coordinates with the government COR. Requires an active Secret clearance, a bachelor\'s in computer science, and 8+ years of experience. AWS certification preferred.',
    tags: ['Proposals', 'Staffing', 'JSON'],
    temperature: 0.1,
    topP: 0.5,
    owner: 'target',
    chatCount: 24,
    bookmarkCount: 2,
  },
  {
    slug: 'proposal-guardian',
    title: 'Proposal Guardian',
    summary: 'Review proposal sections for compliance against solicitation requirements',
    description:
      'Acts as a compliance reviewer, checking a drafted proposal section against the solicitation\'s instructions (Section L) and evaluation criteria (Section M), flagging gaps, unsupported claims, and missing required elements.',
    instructions: `Persona: You are a proposal compliance reviewer (color-team lead). Review the drafted section against the provided solicitation requirements.
Rules:
1. Produce a compliance matrix table: Requirement | Addressed? (Yes/Partial/No) | Evidence / Gap
2. Flag any unsupported claims and any Section L instruction that is not satisfied
3. Note tone, active voice, and win-theme alignment issues briefly at the end
4. Do not rewrite the section — only assess it
Solicitation requirements and drafted section:
`,
    example:
      'Section L requires a staffing approach that addresses surge capacity within 30 days. Draft: "Our team scales rapidly to meet demand." — Assess compliance.',
    tags: ['Proposals', 'Compliance', 'Review'],
    temperature: 0.2,
    topP: 0.7,
    // Owned by a colleague — a popular reusable prompt others bookmark.
    owner: 'okafor_daniel@example.com',
    chatCount: 6,
    bookmarkCount: 13,
  },
  {
    slug: 'rfi-response-strategist',
    title: 'RFI Response Strategist',
    summary: 'Shape a compelling, compliant response to a government RFI',
    description:
      'Helps shape a Request for Information (RFI) response by extracting the government\'s questions, proposing a response outline, and drafting concise capability statements that position the company without over-committing.',
    instructions: `Persona: You are a capture strategist responding to a federal Request for Information (RFI). Help shape a compliant, compelling response.
Rules:
1. First extract every explicit and implicit question the RFI asks
2. Propose a response outline mapped 1:1 to those questions
3. For each section, draft a concise capability statement grounded in the provided past performance — do not invent experience
4. Flag anywhere the RFI hints at future evaluation criteria worth emphasizing
RFI text and relevant past performance:
`,
    example:
      'The RFI asks vendors to describe their experience delivering cloud-native analytics at IL5, their approach to data governance, and estimated timelines to initial operating capability.',
    tags: ['RFI', 'Capture', 'Strategy'],
    temperature: 0.5,
    topP: 0.9,
    owner: 'target',
    chatCount: 11,
    bookmarkCount: 1,
  },
];

// Two chats with real message histories. One belongs to the target user, one to
// a colleague — both count toward their prompts' MOST CHATTED usage.
export const PROMPT_LIBRARY_CHATS: ChatSeed[] = [
  {
    promptSlug: 'rfi-response-strategist',
    owner: 'target',
    summary: 'RFI response — PEO EIS Data Analytics & AI Modernization',
    messages: [
      {
        role: 'user',
        content:
          'Here is the RFI (W52P1J-26-R-0147) for Enterprise Data Analytics and AI Modernization Services. Help me pull out every question the government is asking and map an outline to them.',
      },
      {
        role: 'assistant',
        content:
          'I read through the RFI. Here are the explicit questions it asks:\n\n1. Describe your experience delivering cloud-native analytics platforms at IL5.\n2. Describe your approach to data governance and data mesh.\n3. Provide an estimated timeline to initial operating capability (IOC).\n4. Describe your MLOps and model-governance practices.\n5. Identify relevant past performance on comparable federal programs.\n\nProposed outline, mapped 1:1:\n\n- **§1 Cloud-Native Analytics at IL5** → Q1\n- **§2 Data Governance & Data Mesh** → Q2\n- **§3 Path to IOC (timeline)** → Q3\n- **§4 MLOps & Model Governance** → Q4\n- **§5 Relevant Past Performance** → Q5\n\nWant me to draft §1 first?',
      },
      {
        role: 'user',
        content: 'Yes — draft §1 using our VA and USTRANSCOM past performance. Keep it under 200 words and don\'t over-commit.',
      },
      {
        role: 'assistant',
        content:
          '**§1 — Cloud-Native Analytics at IL5**\n\nMeridian delivers cloud-native analytics within accredited IL5 environments today. On the VA benefits platform we deployed a containerized analytics stack to a FedRAMP-aligned enclave, and on USTRANSCOM we operated a data platform under continuous ATO with automated control inheritance. Our architecture favors managed, government-authorized services (deployable to cArmy) with infrastructure-as-code so environments are reproducible and auditable. We right-size to the mission rather than presuming a fixed toolset, and we validate IL5 boundary controls with the ISSO before go-live.\n\n*(Grounded only in the VA and USTRANSCOM performance you provided — no other claims made. Want me to tighten the tone or adjust emphasis toward evaluation criteria?)*',
      },
    ],
  },
  {
    promptSlug: 'itemized-pd-json-creator',
    // Belongs to colleague Nguyen Linh.
    owner: 'nguyen_linh@example.com',
    summary: 'Position description → itemized JSON (Senior Data Engineer)',
    messages: [
      {
        role: 'user',
        content:
          'Parse this PD into JSON: Senior Data Engineer — designs and maintains data pipelines, mentors junior engineers, coordinates with the government COR. Requires active Secret clearance, bachelor\'s in CS, 8+ years experience. AWS certification preferred.',
      },
      {
        role: 'assistant',
        content:
          '{\n  "title": "Senior Data Engineer",\n  "duties": [\n    "Design and maintain data pipelines",\n    "Mentor junior engineers",\n    "Coordinate with the government COR"\n  ],\n  "requiredQualifications": [\n    "Bachelor\'s degree in Computer Science",\n    "8+ years of experience"\n  ],\n  "preferredQualifications": [\n    "AWS certification"\n  ],\n  "clearance": "Secret",\n  "laborCategory": "Senior Data Engineer",\n  "yearsExperience": 8\n}',
      },
      {
        role: 'user',
        content: 'Perfect. Can you split "design and maintain data pipelines" into two separate duties?',
      },
      {
        role: 'assistant',
        content:
          'Done — here is the updated duties array:\n\n"duties": [\n  "Design data pipelines",\n  "Maintain data pipelines",\n  "Mentor junior engineers",\n  "Coordinate with the government COR"\n]\n\nEverything else in the JSON is unchanged.',
      },
    ],
  },
];
