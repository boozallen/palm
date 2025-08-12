import { render, screen } from '@testing-library/react';

import UserKbProviderRow from './UserKbProviderRow';

describe('UserKbProviderRow', () => {

  const kbProvider = {
    id: '8c1b73e3-a2a6-4b01-8564-0ec642362697',
    label: 'Example Kb Provider',
  };

  beforeEach(() => {
    render(
      <table>
        <tbody>
          <UserKbProviderRow kbProvider={kbProvider} />
        </tbody>
      </table>
    );
  });

  it('should render the provider label', () => {
    expect(screen.getByText(kbProvider.label)).toBeInTheDocument();
  });
});
