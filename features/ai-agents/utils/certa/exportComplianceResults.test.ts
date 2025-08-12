import { downloadComplianceResults, formatRequirementsAnalysis, formatRemediationSteps } from '@/features/ai-agents/utils/certa/exportComplianceResults';
import { PolicyResults, ComplianceStatus, RequirementStatus, ComplianceResult, Policy } from '@/features/ai-agents/types/certa/webPolicyCompliance';

describe('downloadComplianceResults', () => {
  const mockCreateElement = jest.fn();
  const mockAppendChild = jest.fn();
  const mockClick = jest.fn();
  const mockRemove = jest.fn();

  const mockUrl = 'https://example.com/test';
  const mockDate = new Date('2025-01-15T12:00:00Z');
  const mockFormattedDate = 'Jan 15 2025';

  const mockPolicies: Policy[] = [
    {
      id: '098e6f06-3231-4bff-a210-1d2404aba341',
      title: 'Policy 1',
      content: 'Policy 1 Content',
      requirements: 'Policy 1 Requirements',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    document.createElement = mockCreateElement.mockReturnValue({
      setAttribute: jest.fn(),
      click: mockClick,
      remove: mockRemove,
    });
    document.body.appendChild = mockAppendChild;

    jest.useFakeTimers();
    jest.setSystemTime(mockDate);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('formatRequirementsAnalysis', () => {
    it('formats requirements correctly', () => {
      const result: ComplianceResult = {
        complianceStatus: ComplianceStatus.No,
        requirements: [
          {
            requirement: 'Requirement 1',
            status: RequirementStatus.NotMet,
            explanation: 'Failed check',
            evidence: [{ text: 'Evidence text', location: 'Evidence location' }],
          },
          {
            requirement: 'Requirement 2',
            status: RequirementStatus.Met,
            explanation: 'Passed check',
            evidence: [{ text: 'Evidence text', location: 'Evidence location' }],
          },
        ],
        summary: 'Summary',
        overallExplanation: 'Explanation',
        remediationSteps: [],
      };

      const formatted = formatRequirementsAnalysis(result);
      expect(formatted).toBe(
        '1. Requirement 1:\n   Status: Not met\n   Analysis: Failed check\n\n' +
        '2. Requirement 2:\n   Status: Met\n   Analysis: Passed check'
      );
    });

    it('handles requirements with special characters', () => {
      const result: ComplianceResult = {
        complianceStatus: ComplianceStatus.No,
        requirements: [
          {
            requirement: 'Requirement with "quotes", \nnewlines and, commas',
            status: RequirementStatus.NotMet,
            explanation: 'Failed check',
            evidence: [{ text: 'Evidence text', location: 'Evidence location' }],
          },
        ],
        summary: 'Summary',
        overallExplanation: 'Explanation',
        remediationSteps: [],
      };

      const formatted = formatRequirementsAnalysis(result);
      expect(formatted).toBe(
        '1. Requirement with "quotes", \nnewlines and, commas:\n   Status: Not met\n   Analysis: Failed check'
      );
    });
  });

  describe('formatRemediationSteps', () => {
    it('formats multiple steps correctly', () => {
      const result: ComplianceResult = {
        complianceStatus: ComplianceStatus.No,
        requirements: [],
        summary: 'Summary',
        overallExplanation: 'Explanation',
        remediationSteps: ['Fix issue 1', 'Fix issue 2'],
      };

      const formatted = formatRemediationSteps(result);
      expect(formatted).toBe('1. Fix issue 1\n\n2. Fix issue 2');
    });

    it('handles empty remediation steps', () => {
      const result: ComplianceResult = {
        complianceStatus: ComplianceStatus.No,
        requirements: [],
        summary: 'Summary',
        overallExplanation: 'Explanation',
        remediationSteps: [],
      };

      const formatted = formatRemediationSteps(result);
      expect(formatted).toBe('No remediation needed');
    });

    it('handles undefined remediation steps', () => {
      const result: ComplianceResult = {
        complianceStatus: ComplianceStatus.No,
        requirements: [],
        summary: 'Summary',
        overallExplanation: 'Explanation',
        remediationSteps: undefined,
      };

      const formatted = formatRemediationSteps(result);
      expect(formatted).toBe('No remediation needed');
    });
  });

  describe('file creation', () => {
    it('creates and downloads CSV file with correct structure', () => {
      const results: PolicyResults = {
        'Policy 1': {
          isLoading: false,
          result: {
            complianceStatus: ComplianceStatus.No,
            requirements: [
              {
                requirement: 'Requirement 1',
                status: RequirementStatus.NotMet,
                explanation: 'Failed check',
                evidence: [{ text: 'Evidence text', location: 'Evidence location' }],
              },
            ],
            summary: 'Summary',
            overallExplanation: 'Explanation',
            remediationSteps: ['Fix issue 1', 'Fix issue 2'],
          },
        },
      };

      downloadComplianceResults(mockPolicies, results, mockUrl);

      // Verify link creation and download
      expect(mockCreateElement).toHaveBeenCalledWith('a');
      expect(mockAppendChild).toHaveBeenCalled();
      expect(mockClick).toHaveBeenCalled();
      expect(mockRemove).toHaveBeenCalled();

      const setAttributeCalls = mockCreateElement.mock.results[0].value.setAttribute.mock.calls;
      const csvContent = setAttributeCalls.find((call: string[]) => call[0] === 'href')[1];
      const filename = setAttributeCalls.find((call: string[]) => call[0] === 'download')[1];

      // Decode the URL-encoded content
      const decodedContent = decodeURIComponent(csvContent.replace('data:text/csv;charset=utf-8,', ''));

      // Verify file name format
      expect(filename).toMatch(new RegExp(`compliance_results_example_com_test_${mockFormattedDate.replace(/\s/g, '_')}.csv`));

      // Verify CSV structure
      expect(decodedContent).toContain('"Website Reviewed:","example.com/test"');
      expect(decodedContent).toContain('"Policy Name","Compliance Status","Requirements Analysis","Remediation Steps"');
    });
  });
});
