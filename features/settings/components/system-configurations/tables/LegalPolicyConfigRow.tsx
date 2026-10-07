import EditLegalPolicyForm from '@/features/settings/components/system-configurations/forms/EditLegalPolicyForm';

interface LegalPolicyConfigRowProps {
  legalPolicyHeader: string;
  legalPolicyBody: string;
}

const LegalPolicyConfigRow = ({ legalPolicyHeader, legalPolicyBody }: LegalPolicyConfigRowProps) => {
  return (
    <tr data-testid='legal-policy-config-row'>
      <td colSpan={2}>
        <EditLegalPolicyForm legalPolicyHeader={legalPolicyHeader} legalPolicyBody={legalPolicyBody} />
      </td>
    </tr>
  );
};
export default LegalPolicyConfigRow;
