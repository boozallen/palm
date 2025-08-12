import {
  ComplianceResult,
  ComplianceStatus,
  RequirementStatus,
} from '@/features/ai-agents/types/certa/webPolicyCompliance';

export function parseComplianceResponse(response: string): ComplianceResult {
  const cleanedResponse = cleanResponse(response);

  const sections = cleanedResponse
    .split('\n\n')
    .map((s) => s.trim())
    .filter(Boolean);

  if (sections.length < 2) {
    throw new Error('Invalid response format - missing required sections');
  }

  const explanation = sections[0];
  const csvPart = sections.find(s => s.toLowerCase().startsWith('requirement')) ?? sections[1];
  const remediationSection = sections.find(s => s.toLowerCase().includes('remediation steps')) ?? sections[2] ?? '';

  const requirements = parseCSVRequirements(csvPart);
  const remediationSteps = extractRemediationSteps(remediationSection);

  const complianceCount = requirements.reduce(
    (acc, req) => ({
      met: acc.met + (req.status === RequirementStatus.Met ? 1 : 0),
      partial: acc.partial + (req.status === RequirementStatus.PartiallyMet ? 1 : 0),
      total: acc.total + 1,
    }),
    { met: 0, partial: 0, total: 0 }
  );

  return {
    complianceStatus: determineComplianceStatus(complianceCount),
    requirements,
    summary: '',
    overallExplanation: explanation,
    remediationSteps: remediationSteps.length > 0 ? remediationSteps : undefined,
  };
}

function parseCSVRequirements(csvPart: string) {
  const lines = csvPart.split('\n').filter(Boolean);
  if (lines.length < 2) {
    return [];
  }

  return lines.slice(1).map((line) => {
    const matches = line.match(/"([^"]*)"|[^,]+/g);
    if (!matches || matches.length < 2) {
      return null;
    }

    const [requirement, status, evidenceText = '', evidenceLocation = '', explanation = ''] =
      matches.map(m => m.replace(/^"|"$/g, '').trim());

    return {
      requirement,
      status: convertToRequirementStatus(status),
      evidence: [{
        text: evidenceText,
        location: evidenceLocation || 'None',
      }],
      explanation: explanation || status,
    };
  }).filter((req): req is NonNullable<typeof req> => req !== null);
}

function extractRemediationSteps(text: string): string[] {
  const match = RegExp(/remediation\s+steps:?\s*\n([\s\S]*)/i).exec(text);
  if (!match?.[1]) {
    return [];
  }

  const stepsBlock = match[1];

  return stepsBlock
    .split('\n')
    .map(line => line.replace(/^[\d*.\-]+[.)]?\s*/, '').trim())
    .filter(Boolean);
}

export function determineComplianceStatus(counts: {
  met: number;
  partial: number;
  total: number;
}): ComplianceStatus {
  if (counts.total === 0) {
    return ComplianceStatus.VeryUnclear;
  }
  
  const rate = (counts.met + counts.partial * 0.75) / counts.total;

  if (rate === 1) {
    return ComplianceStatus.Yes;
  }

  if (rate >= 0.7) {
    return ComplianceStatus.LeanYes;
  }

  if (rate <= 0.3) {
    return ComplianceStatus.No;
  }

  if (rate <= 0.5) {
    return ComplianceStatus.LeanNo;
  }
  return ComplianceStatus.VeryUnclear;
}

export function convertToRequirementStatus(status: string): RequirementStatus {
  const lower = status.toLowerCase().trim();
  if (lower === 'met') {
    return RequirementStatus.Met;
  }

  if (lower.includes('partial')) {
    return RequirementStatus.PartiallyMet;
  }

  if (lower === 'not met' || lower === 'no') {
    return RequirementStatus.NotMet;
  }
  return RequirementStatus.NotMet;
}

export function cleanResponse(response: string): string {
  const lines = response.split('\n');
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    if (
      line.includes('original') && (line.includes('answer') || line.includes('analysis') || line.includes('findings')) ||
      line.includes('new context') ||
      line.includes('additional context') || 
      line.includes('maintain original') ||
      line.trim() === ''
    ) {
      continue;
    }
    startIndex = i;
    break;
  }
  return lines.slice(startIndex).join('\n');
}
