import { 
  parseComplianceResponse, 
  cleanResponse, 
  determineComplianceStatus, 
  convertToRequirementStatus, 
} from '@/features/ai-agents/utils/certa/resultParser';
import {
  ComplianceStatus,
  RequirementStatus,
} from '@/features/ai-agents/types/certa/webPolicyCompliance';

describe('parseComplianceResponse', () => {
  it('should parse a valid response with explanation, CSV, and remediation steps', () => {
    const response = 'Explanation paragraph\n\nRequirement,Status,Evidence Text,Evidence Location,Explanation\n"Req1","Met","Evidence1","Location1","Explanation1"\n"Req2","Not Met","Evidence2","Location2","Explanation2"\n\nRemediation Steps:\n1. Step One\n2. Step Two';

    const result = parseComplianceResponse(response);

    expect(result.complianceStatus).toBe(ComplianceStatus.LeanNo);
    expect(result.requirements).toEqual([
      {
        requirement: 'Req1',
        status: RequirementStatus.Met,
        evidence: [
          { text: 'Evidence1', location: 'Location1' },
        ],
        explanation: 'Explanation1',
      },
      {
        requirement: 'Req2',
        status: RequirementStatus.NotMet,
        evidence: [
          { text: 'Evidence2', location: 'Location2' },
        ],
        explanation: 'Explanation2',
      },
    ]);
    expect(result.remediationSteps).toEqual(['Step One', 'Step Two']);
    expect(result.overallExplanation).toBe('Explanation paragraph');
  });

  it('should throw an error for responses missing required sections', () => {
    const response = 'Explanation only, No CSV or remediation';

    expect(() => parseComplianceResponse(response)).toThrow('Invalid response format - missing required sections');
  });

  it('should handle a response without remediation steps', () => {
    const response = 'Explanation paragraph\n\nRequirement,Status,Evidence Text,Evidence Location,Explanation\n"Req1","Met","Evidence1","Location1","Explanation1"\n"Req2","Not Met","Evidence2","Location2","Explanation2"';

    const result = parseComplianceResponse(response);

    expect(result.complianceStatus).toBe(ComplianceStatus.LeanNo);
    expect(result.requirements).toHaveLength(2);
    expect(result.remediationSteps).toBeUndefined();
  });

  it('should parse CSV with partially met requirements', () => {
    const response = 'Explanation paragraph\n\nRequirement,Status,Evidence Text,Evidence Location,Explanation\n"Req1","Partially Met","Evidence1","Location1","Explanation1"\n"Req2","Met","Evidence2","Location2","Explanation2"';

    const result = parseComplianceResponse(response);

    expect(result.complianceStatus).toBe(ComplianceStatus.LeanYes);
    expect(result.requirements).toEqual([
      {
        requirement: 'Req1',
        status: RequirementStatus.PartiallyMet,
        evidence: [
          { text: 'Evidence1', location: 'Location1' },
        ],
        explanation: 'Explanation1',
      },
      {
        requirement: 'Req2',
        status: RequirementStatus.Met,
        evidence: [
          { text: 'Evidence2', location: 'Location2' },
        ],
        explanation: 'Explanation2',
      },
    ]);
  });

  it('should handle empty evidence text and location gracefully', () => {
    const response = 'Explanation paragraph\n\nRequirement,Status,Evidence Text,Evidence Location,Explanation\n"Req1","Met","","","Explanation1"';

    const result = parseComplianceResponse(response);

    expect(result.requirements).toEqual([
      {
        requirement: 'Req1',
        status: RequirementStatus.Met,
        evidence: [
          { text: '', location: 'None' },
        ],
        explanation: 'Explanation1',
      },
    ]);
  });

  it('should handle malformed CSV rows gracefully', () => {
    const response = 'Explanation paragraph\n\nRequirement,Status,Evidence Text,Evidence Location,Explanation\n"Req1","Met","Evidence1","Location1","Explanation1"\nMalformedRow';

    const result = parseComplianceResponse(response);

    expect(result.requirements).toHaveLength(1);
  });
});

describe('cleanResponse', () => {
  it('should remove lines with preface patterns and return remaining content', () => {
    const response = 'Original Answer: This is a preface\nNew Context: Another preface\nExplanation starts here\nMore details follow';

    const result = cleanResponse(response);

    expect(result).toBe('Explanation starts here\nMore details follow');
  });

  it('should handle responses with no prefaces and return the entire response', () => {
    const response = 'Explanation starts here\nMore details follow';

    const result = cleanResponse(response);

    expect(result).toBe(response);
  });

  it('should handle mixed-case prefaces correctly', () => {
    const response = 'original Answer: Preface\nNEW context: Preface\nAdditional context\nExplanation starts here';

    const result = cleanResponse(response);

    expect(result).toBe('Explanation starts here');
  });

  it('should return an empty string for an empty response', () => {
    const response = '';

    const result = cleanResponse(response);

    expect(result).toBe('');
  });

  it('should handle responses with no newlines', () => {
    const response = 'Original Answer: This is a preface';

    const result = cleanResponse(response);

    expect(result).toBe(response);
  });

  it('should handle responses with multiple real content lines', () => {
    const response = 'Original Answer: Preface\nExplanation starts here\nMore content follows\nEven more details';

    const result = cleanResponse(response);

    expect(result).toBe('Explanation starts here\nMore content follows\nEven more details');
  });
});

describe('determineComplianceStatus', () => {
  it('returns Yes if all requirements are met', () => {
    const counts = { met: 3, partial: 0, total: 3 };

    const result = determineComplianceStatus(counts);

    expect(result).toBe(ComplianceStatus.Yes);
  });

  it('returns Lean Yes if most requirements are met', () => {
    const counts = { met: 7, partial: 0, total: 10 };

    const result = determineComplianceStatus(counts);

    expect(result).toBe(ComplianceStatus.LeanYes);
  });

  it('returns Lean No if less than half requirements are met', () => {
    const counts = { met: 3, partial: 2, total: 10 };

    const result = determineComplianceStatus(counts);

    expect(result).toBe(ComplianceStatus.LeanNo);
  });

  it('returns No if no requirements are met', () => {
    const counts = { met: 0, partial: 0, total: 5 };

    const result = determineComplianceStatus(counts);

    expect(result).toBe(ComplianceStatus.No);
  });

  it('returns Very Unclear if none of the above conditions are met', () => {
    const counts = { met: 6, partial: 0, total: 10 };

    const result = determineComplianceStatus(counts);

    expect(result).toBe(ComplianceStatus.VeryUnclear);
  });
});

describe('convertToRequirementStatus', () => {
  it('converts met string to RequirementStatus.Met', () => {
    const result = convertToRequirementStatus('Met');

    expect(result).toBe(RequirementStatus.Met);
  });

  it('converts partially met string to RequirementStatus.PartiallyMet', () => {
    const result = convertToRequirementStatus('Partially Met');

    expect(result).toBe(RequirementStatus.PartiallyMet);
  });

  it('converts not met string to RequirementStatus.NotMet', () => {
    const result = convertToRequirementStatus('Not Met');

    expect(result).toBe(RequirementStatus.NotMet);
  });

  it('defaults to NotMet for unrecognized statuses', () => {
    const result = convertToRequirementStatus('Unknown Status');

    expect(result).toBe(RequirementStatus.NotMet);
  });
});
