import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import SystemMessageConfigRow from './SystemMessageConfigRow';
import { SystemConfigFields } from '@/features/shared/types';
import { useUpdateSystemConfig } from '@/features/settings/api/update-system-config';
import { JSX } from 'react';

jest.mock('@/features/settings/api/update-system-config');

const TableRowWrapper = ({ children }: { children: JSX.Element }) => (
  <table>
    <tbody>{children}</tbody>
  </table>
);
describe('SystemMessageConfigRow Component', () => {
  const systemMessage = 'System Message';
  const newSystemMessage = 'New System Message';

  beforeEach(() => {
    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutate: jest.fn(),
    });
    render(
      <TableRowWrapper>
        <SystemMessageConfigRow systemMessage={systemMessage} />
      </TableRowWrapper>
    );
  });

  it('renders the system message textarea with the initial value', () => {
    const textarea = screen.getByTestId('system-message-textarea');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue(systemMessage);
  });

  it('updates the system message when the textarea value changes', () => {
    const newSystemMessage = 'New System Message';
    const textarea = screen.getByTestId('system-message-textarea');

    fireEvent.change(textarea, { target: { value: newSystemMessage } });

    expect(textarea).toHaveValue(newSystemMessage);
  });

  it('saves the new system message when the update button is clicked', async () => {
    const mutateMock = jest.fn();
    (useUpdateSystemConfig as jest.Mock).mockReturnValue({
      mutate: mutateMock,
    });

    const textarea = screen.getByTestId('system-message-textarea');
    const updateButton = screen.getByText('Update');

    fireEvent.change(textarea, { target: { value: newSystemMessage } });
    fireEvent.click(updateButton);

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          configField: SystemConfigFields.SystemMessage,
          configValue: newSystemMessage,
        }),
        expect.objectContaining({
          onError: expect.any(Function),
        })
      );
    });
  });
});
