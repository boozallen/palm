import { ANY_TYPE, type GraphSchema, type PropertyDef } from './types';

/**
 * Government Pursuit / proposal-analysis extraction schema.
 *
 * General-purpose across solicitation types (RFP, RFI, ChBA, OTA, task order) and
 * agencies — validated against FAA (ChBA/SOO), VA (RFI/PWS), and GSA (PWS + SLA).
 * Captures what the government asks for, how it's evaluated, what's constrained, the
 * systems/data/roles involved, and the gaps/assumptions an offeror derives — each
 * grounded to source text.
 *
 * PROVENANCE CONTRACT: this schema has NO origin/assertionType property. Provenance
 * (government_stated | model_inferred | bah_interpretation) is stamped by the build
 * worker from the source document's origin, never inferred by the extraction LLM.
 * The topical axis (DevSecOps, AI, cloud, …) is handled by Concepts + retrieval, not
 * by entity properties.
 */

// Locator applied to every node and edge. The verbatim supporting span is already
// captured natively as the extractor's built-in `context` field, so we only add the
// human-readable section locator here.
const GROUNDING: PropertyDef[] = [
  { name: 'sourceSection', type: 'string', description: 'Locator in the source (e.g. "SOO Obj 6", "PWS 5.2.9", "Q&A #12", "SLA: Cost").' },
];

export const governmentPursuit: GraphSchema = {
  key: 'government-pursuit',
  name: 'Government Pursuit',
  description:
    'Solicitation-analysis ontology: opportunities, requirements, evaluation factors, deliverables, systems, roles, performance standards, constraints, compliance, data, and offeror-derived gaps/assumptions — grounded to source text.',

  nodeTypes: [
    {
      type: 'Opportunity',
      description: 'The pursuit/solicitation being analyzed.',
      examples: ['ATLAS Challenge Based Acquisition', 'GSA Fleet Systems Modernization (COMET)'],
      properties: [
        { name: 'solicitationNumber', type: 'string', description: 'Solicitation / RFP / notice number.' },
        { name: 'vehicleType', type: 'string', description: 'RFP | IDIQ | GWAC | OTA | ChBA | Task Order | BPA.' },
        { name: 'contractType', type: 'string', description: 'FFP | T&M | Labor Hour | Cost-Reimbursable | hybrid, when stated.' },
        { name: 'naics', type: 'string', description: 'NAICS code.' },
        { name: 'dueDate', type: 'date', description: 'Response/proposal due date.' },
        { name: 'awardDate', type: 'date', description: 'Anticipated award date.' },
        { name: 'value', type: 'number', description: 'Estimated value or ceiling (USD).' },
        { name: 'setAside', type: 'string', description: 'Set-aside (8(a), SDVOSB, full & open, …).' },
        { name: 'periodOfPerformance', type: 'string', description: 'PoP incl. options (e.g. "10 years").' },
        { name: 'scopeSummary', type: 'string', description: 'One-line scope (e.g. "~200 apps, 3,000 databases").' },
        ...GROUNDING,
      ],
    },
    {
      type: 'Agency',
      description: 'The buying / customer government organization.',
      examples: ['Federal Aviation Administration (AIT/ADE)', 'VA Office of Information & Technology'],
      properties: [
        { name: 'tier', type: 'string', description: 'department | sub-agency | program office.' },
        { name: 'parentAgency', type: 'string', description: 'Parent organization, if a sub-unit.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'SourceDocument',
      description: 'A solicitation artifact the corpus is built from.',
      examples: ['Statement of Objectives (Attachment 1)', 'Draft PWS', 'Phase 2 Q&A', 'Service Level Agreement (Attachment F)'],
      properties: [
        { name: 'docType', type: 'string', description: 'SOO | PWS | Draft PWS | Section L | Section M | Announcement | RFI | RFP | Q&A | Amendment | SLA | QASP | Reps & Certs | GFI | Attachment.' },
        { name: 'version', type: 'string', description: 'Version / revision label.' },
        { name: 'documentDate', type: 'date', description: 'Issue date of this document.' },
        { name: 'sensitivity', type: 'string', description: 'public | SUI | CUI | proprietary.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'Requirement',
      description: 'Something the government asks the offeror to do, provide, or achieve. Covers binding requirements AND desired objectives/outcomes — distinguished by obligationLevel. PWS tasks and their subtasks are Requirements linked by PART_OF.',
      examples: ['Submit a written Rationalization Matrix', 'Achieve cATO', 'Provide a monthly Progress Report'],
      properties: [
        { name: 'obligationLevel', type: 'string', description: 'mandatory ("shall/must") | desired ("should") | objective ("desired end-state/encouraged") | optional ("optional task/CLIN").' },
        { name: 'requirementId', type: 'string', description: 'Identifier as written (e.g. "Obj 4", "PWS 5.2.9", "Subfactor 1").' },
        { name: 'section', type: 'string', description: 'Source section the requirement comes from.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'EvaluationFactor',
      description: 'A factor or subfactor the government scores the response against.',
      examples: ['Factor 1 – Portfolio Rationalization', 'Subfactor 2 – Process Demonstration'],
      properties: [
        { name: 'parentFactor', type: 'string', description: 'Parent factor, if this is a subfactor.' },
        { name: 'importance', type: 'string', description: 'Relative importance / weighting language.' },
        { name: 'ratingMethod', type: 'string', description: 'adjectival | color | numeric | best-value tradeoff | LPTA.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'Deliverable',
      description: 'A required submission, artifact, report, plan, or demonstration.',
      examples: ['Rationalization Matrix (written)', '15-minute demonstration video', 'Contractor Quality Control Plan'],
      properties: [
        { name: 'format', type: 'string', description: 'written | video | demo | report | plan | matrix | briefing.' },
        { name: 'dueDate', type: 'date', description: 'Delivery due date.' },
        { name: 'limits', type: 'string', description: 'Constraints (e.g. "15-min max", "30-page limit").' },
        ...GROUNDING,
      ],
    },
    {
      type: 'System',
      description: 'A system, application, platform, or product in scope (current-state or target). Sub-systems/modules link to their parent by PART_OF.',
      examples: ['IACRA', 'VistA', 'GSAFleet.gov', 'Vehicle Marketplace'],
      properties: [
        { name: 'disposition', type: 'string', description: 'Retire | Consolidate | Re-platform | Re-architect | Replace, when stated.' },
        { name: 'technology', type: 'string', description: 'Known language / DB / platform.' },
        { name: 'criticality', type: 'string', description: 'mission/safety-critical | standard.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'Process',
      description: 'A workflow, method, or process referenced or required.',
      examples: ['Modernization Factory', 'CI/CD security gating', 'Agile sprint execution'],
      properties: [
        { name: 'automationLevel', type: 'string', description: 'manual | assisted | automated | AI-driven — only when explicitly stated; omit if ambiguous.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'CapabilityArea',
      description: 'A solution capability/competency. Named internal/partner offerings are instances with `provider` set.',
      examples: ['DevSecOps', 'Application rationalization', 'Cloud migration accelerator'],
      properties: [
        { name: 'provider', type: 'string', description: 'government | commercial | BAH | partner — distinguishes internal offerings from generic capabilities.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'Role',
      description: 'A required role, key personnel position, or labor category the offeror must staff.',
      examples: ['Program Manager (Key Personnel)', 'MUMPS Developer', 'Scrum Master'],
      properties: [
        { name: 'laborCategory', type: 'string', description: 'Labor category / role title.' },
        { name: 'clearance', type: 'string', description: 'Required clearance or background investigation level.' },
        { name: 'keyPersonnel', type: 'boolean', description: 'Whether designated as Key Personnel.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'Constraint',
      description: 'A non-compliance limit on how the work or response is done.',
      examples: ['Government owns all work products', 'No internet from the SUI enclave', 'Page limits', 'OCI mitigation required'],
      properties: [
        { name: 'constraintType', type: 'string', description: 'data rights | place of performance | schedule | format | access | OCI | other — only when explicitly stated; omit if ambiguous.' },
        { name: 'mandatory', type: 'boolean', description: 'Whether strictly enforced.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'ComplianceObligation',
      description: 'A named standard, framework, regulation, or FAR/agency clause that must be met.',
      examples: ['NIST 800-53', 'cATO', 'FedRAMP High', 'Section 508', 'VAAR 852.219-73'],
      properties: [
        { name: 'framework', type: 'string', description: 'Named framework/standard/regime/clause.' },
        { name: 'level', type: 'string', description: 'Level/impact (High | Moderate | Low | IL5 | …).' },
        { name: 'mandatory', type: 'boolean', description: 'Whether mandated vs recommended.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'PerformanceStandard',
      description: 'A measurable performance target / SLA / metric the contractor is held to (from SLA, QASP, or performance-metrics sections).',
      examples: ['99.9% availability', 'Cost variance < 10% (monthly)', 'RTO/RPO targets'],
      properties: [
        { name: 'metric', type: 'string', description: 'What is measured (e.g. availability, cost variance, defect rate).' },
        { name: 'standard', type: 'string', description: 'The performance standard / expected outcome.' },
        { name: 'aql', type: 'string', description: 'Acceptable Quality Level / threshold (e.g. "< 10% variance").' },
        { name: 'method', type: 'string', description: 'Measurement method / surveillance approach.' },
        { name: 'frequency', type: 'string', description: 'Measurement frequency (e.g. monthly).' },
        ...GROUNDING,
      ],
    },
    {
      type: 'DataType',
      description: 'A category of data with handling implications.',
      examples: ['FAA SUI', 'CUI', 'PHI / Veteran health data'],
      properties: [
        { name: 'sensitivity', type: 'string', description: 'SUI | CUI | PII | PHI | classified | public.' },
        { name: 'handlingRule', type: 'string', description: 'Stated handling/storage/transmission rule.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'Technology',
      description: 'A named tool, platform, language, or service — approved, furnished, or prohibited.',
      examples: ['AWS Bedrock', 'ServiceNow', 'MUMPS', 'Kiteworks'],
      properties: [
        { name: 'techCategory', type: 'string', description: 'cloud | AI-ML | platform | tool | language — only when explicitly stated; omit if ambiguous.' },
        { name: 'approvalStatus', type: 'string', description: 'approved | permitted | prohibited | government-furnished.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'Assumption',
      description: 'A position not directly supported by the source text (offeror/model-derived). Typically origin=model_inferred or bah_interpretation.',
      examples: ['Government expects the contractor to fund the FedRAMP-High enclave'],
      properties: [
        { name: 'basis', type: 'string', description: 'Why this is assumed.' },
        { name: 'supported', type: 'boolean', description: 'Whether any source text backs it (usually false).' },
        ...GROUNDING,
      ],
    },
    {
      type: 'Gap',
      description: 'Missing information, SME input, or partner support the documents do not resolve.',
      examples: ['No full application inventory until Phase 4'],
      properties: [
        { name: 'gapType', type: 'string', description: 'missing-info | SME-needed | partner-needed | ambiguous — only when explicitly characterizable; omit if unclear.' },
        { name: 'impact', type: 'string', description: 'What it blocks (pricing, staffing, design, …).' },
        ...GROUNDING,
      ],
    },
    {
      type: 'Clarification',
      description: 'A Q&A answer or amendment that interprets or changes a requirement/section.',
      examples: ['Q&A #6 — disregard FAA Toolchain.docx', 'Q&A #11 — CUI cover pages excluded from page limits'],
      properties: [
        { name: 'questionId', type: 'string', description: 'Q&A item or amendment number.' },
        { name: 'changesScope', type: 'boolean', description: 'Whether it materially changes a requirement.' },
        ...GROUNDING,
      ],
    },
    {
      type: 'Phase',
      description: 'A stage or key milestone in the acquisition timeline.',
      examples: ['Phase 2 – Rationalization', 'Contract award'],
      properties: [
        { name: 'phaseNumber', type: 'string', description: 'Phase/stage identifier.' },
        { name: 'dueDate', type: 'date', description: 'Key date for this phase.' },
        { name: 'status', type: 'string', description: 'completed | active | upcoming.' },
        ...GROUNDING,
      ],
    },
  ],

  conceptCategories: [
    'MODERNIZATION', 'DEVSECOPS', 'CLOUD', 'DATA_MANAGEMENT', 'SECURITY_COMPLIANCE',
    'AI_ML', 'USER_EXPERIENCE', 'GOVERNANCE', 'GENERAL',
  ],

  edgeTypes: [
    { relationType: 'ISSUED_BY', description: 'A pursuit is issued by an agency.',
      allowedEndpoints: [['Opportunity', 'Agency']], properties: [...GROUNDING] },
    { relationType: 'PART_OF', description: 'Structural containment (document→pursuit, subtask→task, module→system).',
      allowedEndpoints: [['SourceDocument', 'Opportunity'], ['Phase', 'Opportunity'], ['EvaluationFactor', 'EvaluationFactor'], ['System', 'System'], ['Requirement', 'Requirement']], properties: [...GROUNDING] },
    { relationType: 'STATED_IN', description: 'An assertion is stated in a specific source document (traceability).',
      allowedEndpoints: [[ANY_TYPE, 'SourceDocument']], properties: [...GROUNDING] },
    { relationType: 'HAS_REQUIREMENT', description: 'A pursuit/phase imposes a requirement.',
      allowedEndpoints: [['Opportunity', 'Requirement'], ['Phase', 'Requirement']], properties: [...GROUNDING] },
    { relationType: 'TARGETS', description: 'A requirement targets a system/application.',
      allowedEndpoints: [['Requirement', 'System']], properties: [...GROUNDING] },
    { relationType: 'SATISFIED_BY', description: 'A requirement is satisfied by a deliverable.',
      allowedEndpoints: [['Requirement', 'Deliverable']], properties: [...GROUNDING] },
    { relationType: 'EVALUATED_BY', description: 'A deliverable/requirement/phase is scored by an evaluation factor.',
      allowedEndpoints: [['Deliverable', 'EvaluationFactor'], ['Requirement', 'EvaluationFactor'], ['Phase', 'EvaluationFactor']],
      properties: [{ name: 'importance', type: 'string', description: 'Weighting/importance of this factor here.' }, ...GROUNDING] },
    { relationType: 'MEASURED_BY', description: 'A requirement/deliverable/system/pursuit is measured by a performance standard or SLA.',
      allowedEndpoints: [['Requirement', 'PerformanceStandard'], ['Deliverable', 'PerformanceStandard'], ['System', 'PerformanceStandard'], ['Opportunity', 'PerformanceStandard']], properties: [...GROUNDING] },
    { relationType: 'REQUIRES_ROLE', description: 'A pursuit/requirement requires a role or key personnel.',
      allowedEndpoints: [['Opportunity', 'Role'], ['Requirement', 'Role']], properties: [...GROUNDING] },
    { relationType: 'CONSTRAINED_BY', description: 'A requirement/pursuit is bound by a constraint or compliance obligation.',
      allowedEndpoints: [['Requirement', 'Constraint'], ['Requirement', 'ComplianceObligation'], ['Opportunity', 'Constraint'], ['Opportunity', 'ComplianceObligation']], properties: [...GROUNDING] },
    { relationType: 'GOVERNS', description: 'A compliance obligation/constraint governs data or a system.',
      allowedEndpoints: [['ComplianceObligation', 'DataType'], ['ComplianceObligation', 'System'], ['Constraint', 'DataType']], properties: [...GROUNDING] },
    { relationType: 'USES', description: 'A requirement/process/deliverable uses a technology or data type.',
      allowedEndpoints: [['Requirement', 'Technology'], ['Process', 'Technology'], ['Requirement', 'DataType'], ['Deliverable', 'Technology']], properties: [...GROUNDING] },
    { relationType: 'ADDRESSED_BY', description: 'A requirement/constraint is addressed by a capability (often a BAH mapping → provenance bah_interpretation).',
      allowedEndpoints: [['Requirement', 'CapabilityArea'], ['Constraint', 'CapabilityArea']],
      properties: [{ name: 'rationale', type: 'string', description: 'Why the capability addresses this.' }, ...GROUNDING] },
    { relationType: 'DEPENDS_ON', description: 'A dependency between requirements, systems, or deliverables.',
      allowedEndpoints: [['Requirement', 'Requirement'], ['System', 'System'], ['Deliverable', 'Requirement']], properties: [...GROUNDING] },
    { relationType: 'ABOUT', description: 'An assumption or gap attaches to the thing it concerns.',
      allowedEndpoints: [['Assumption', ANY_TYPE], ['Gap', ANY_TYPE]], properties: [...GROUNDING] },
    { relationType: 'AMENDS', description: 'A clarification amends/interprets a requirement, section, or document.',
      allowedEndpoints: [['Clarification', ANY_TYPE]],
      properties: [{ name: 'supersedes', type: 'boolean', description: 'Whether it overrides prior text.' }, ...GROUNDING] },
    { relationType: 'RELATES_TO', description: 'General association where no specific edge applies.',
      allowedEndpoints: [[ANY_TYPE, ANY_TYPE]], properties: [...GROUNDING] },
  ],

  guidance:
    'Extract only what the source text states. Every node/edge must carry a sourceSection locator, and put the supporting span in the built-in `context` field. ' +
    'Set obligationLevel from modal language: "shall/must/required" → mandatory, "should" → desired, "objective/outcome/encouraged/desired end-state" → objective, "optional task/CLIN" → optional. ' +
    'Capture identifiers, dates, standards, levels, and SLA targets (metric, AQL, method, frequency) as properties when stated. ' +
    'For classifier properties (automationLevel, constraintType, gapType, techCategory) only set a value when the text makes it explicit; otherwise omit the property. ' +
    'Do NOT invent requirements: if something is implied but not stated, model it as an Assumption or a Gap, never a Requirement. ' +
    'Do NOT output an origin/assertionType — provenance is assigned by the system from the document, not by you. ' +
    'Use one node per real-world entity so recurring items (e.g. cATO, SUI, NIST 800-53, key roles) resolve across documents.',
};
