import EditTermsOfUseForm from '@/features/settings/components/system-configurations/forms/EditTermsOfUseForm';

interface TermsOfUseConfigRowProps {
  termsOfUseHeader: string;
  termsOfUseBody: string;
  termsOfUseCheckboxLabel: string;
}

const TermsOfUseConfigRow = ({ termsOfUseHeader, termsOfUseBody, termsOfUseCheckboxLabel }: TermsOfUseConfigRowProps) => {

  return (
    <tr data-testid='terms-of-use-config-row'>
      <td colSpan={2}>
        <EditTermsOfUseForm termsOfUseHeader={termsOfUseHeader} termsOfUseBody={termsOfUseBody} termsOfUseCheckboxLabel={termsOfUseCheckboxLabel} />
      </td>
    </tr>
  );
};
export default TermsOfUseConfigRow;
