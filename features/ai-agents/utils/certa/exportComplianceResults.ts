import { PolicyResults, ComplianceResult, Policy } from '@/features/ai-agents/types/certa/webPolicyCompliance';

export const downloadComplianceResults = (
  selectedPolicies: Policy[],
  results: PolicyResults,
  url: string,
) => {
  const cleanUrl = url.replace(/^(https?:\/\/)/, '');

  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).replace(/,/g, '');

  // Make sure title row has 4 columns
  const titleRow = [
    'Website Reviewed:',
    cleanUrl,
    currentDate,
    '',
  ].map(cell => `"${cell}"`);

  const emptyRow = ['', '', '', ''].map(cell => `"${cell}"`);

  const headerRow = [
    'Policy Name',
    'Compliance Status',
    'Requirements Analysis',
    'Remediation Steps',
  ].map(cell => `"${cell}"`);

  const csvRows = [
    titleRow,
    emptyRow,
    headerRow,
    emptyRow,
  ];

  selectedPolicies.forEach(policy => {
    const result = results[policy.title]?.result;
    if (result) {
      const requirementsAnalysis = formatRequirementsAnalysis(result);
      const remediationSteps = formatRemediationSteps(result);

      csvRows.push([
        policy.title,
        result.complianceStatus,
        requirementsAnalysis,
        remediationSteps,
      ].map(cell => `"${cell?.replace(/"/g, '""')}"`));
    }
  });

  const csvContent = 'data:text/csv;charset=utf-8,' +
    csvRows.map(row => row.join(',')).join('\n');

  const sanitizedUrl = cleanUrl.replace(/[^a-z0-9]/gi, '_').toLowerCase();
  const filename = `compliance_results_${sanitizedUrl}_${currentDate.replace(/\s/g, '_')}.csv`;

  downloadFile(csvContent, filename);
};

export const formatRequirementsAnalysis = (result: ComplianceResult) => {
  return result.requirements
    .map((req, index) =>
      `${index + 1}. ${req.requirement}:\n   Status: ${req.status}\n   Analysis: ${req.explanation}`
    )
    .join('\n\n');
};

export const formatRemediationSteps = (result: ComplianceResult) => {
  return result.remediationSteps?.length
    ? result.remediationSteps
      .map((step, index) => `${index + 1}. ${step}`)
      .join('\n\n')
    : 'No remediation needed';
};

const downloadFile = (content: string, filename: string) => {
  const encodedUri = encodeURI(content);
  const link = document.createElement('a');
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
};
