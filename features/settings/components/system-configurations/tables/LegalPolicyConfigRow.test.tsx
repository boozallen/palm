import { render, screen } from '@testing-library/react';
import LegalPolicyConfigRow from '@/features/settings/components/system-configurations/tables/LegalPolicyConfigRow';
import { JSX } from 'react';

jest.mock('@/features/settings/components/system-configurations/forms/EditLegalPolicyForm', () => ({
  __esModule: true,
  default: () => <div data-testid='mock-edit-legal-policy-form' />,
}));

const TableRowWrapper = ({ children }: { children: JSX.Element }) => (
  <table>
    <tbody>{children}</tbody>
  </table>
);

describe('LegalPolicyConfigRow Component', () => {
  const legalPolicyHeader = 'Header';
  const legalPolicyBody = 'Body';

  beforeEach(() => {
    render(
      <TableRowWrapper>
        <LegalPolicyConfigRow legalPolicyHeader={legalPolicyHeader} legalPolicyBody={legalPolicyBody} />
      </TableRowWrapper>
    );
  });

  it('should render EditLegalPolicyForm inside LegalPolicyConfigRow', () => {
    expect(screen.getByTestId('legal-policy-config-row')).toBeInTheDocument();
    expect(screen.getByTestId('mock-edit-legal-policy-form')).toBeInTheDocument();
  });

});
