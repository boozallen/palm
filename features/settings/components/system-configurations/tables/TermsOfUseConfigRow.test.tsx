import { render, screen } from '@testing-library/react';
import { useUpdateSystemConfig } from '@/features/settings/api/update-system-config';
import TermsOfUseConfigRow from '@/features/settings/components/system-configurations/tables/TermsOfUseConfigRow';
import { JSX } from 'react';

jest.mock('@/features/settings/api/update-system-config');

const TableRowWrapper = ({ children }: { children: JSX.Element }) => (
  <table>
    <tbody>{children}</tbody>
  </table>
);
describe('TermsOfUseConfigRow Component', () => {
  const termsOfUseHeader = 'Header';
  const termsOfUseBody = 'Body';
  const termsOfUseCheckboxLabel = 'Checkbox label';

  beforeEach(() => {
    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });
    render(
      <TableRowWrapper>
        <TermsOfUseConfigRow termsOfUseHeader={termsOfUseHeader} termsOfUseBody={termsOfUseBody} termsOfUseCheckboxLabel={termsOfUseCheckboxLabel} />
      </TableRowWrapper>
    );
  });

  it('should render EditTermsOfUseForm', () => {
    const formHeader = screen.getByTestId('terms-of-use-header-textarea');
    const formBody = screen.getByTestId('terms-of-use-body-textarea');
    const formCheckboxLabel = screen.getByTestId('terms-of-use-checkbox-label-textarea');

    expect(formHeader).toBeInTheDocument();
    expect(formBody).toBeInTheDocument();
    expect(formCheckboxLabel).toBeInTheDocument();
  });
});
