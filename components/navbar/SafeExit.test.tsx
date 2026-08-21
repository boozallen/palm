import { fireEvent, render } from '@testing-library/react';

import { SafeExitProvider } from '@/features/shared/utils/SafeExitContext';
import SafeExit from './SafeExit';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('SafeExit', () => {

  const mockOpenModal = jest.fn();
  const mockClickHandler = jest.fn();

  const SafeExitWrapper = ({ children }: any) => {
    return (
      <SafeExitProvider value={{ openModal: mockOpenModal, setSafeExitFormToDirty: jest.fn() }}>
        {children}
      </SafeExitProvider>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders successfully with tabIndex as 0', () => {
    const { container, getByText, getByTestId } = render(
      <SafeExitWrapper>
        <SafeExit>
          <div>child</div>
        </SafeExit>
      </SafeExitWrapper>
    );

    expect(container).toBeTruthy();
    expect(getByText('child')).toBeInTheDocument();

    const safeExit = getByTestId('safeExit');
    expect(safeExit.getAttribute('tabIndex')).toEqual('0');
  });

  it('handles defined props correctly', () => {
    const { getByTestId } = render(
      <SafeExitWrapper>
        <SafeExit href='/test' className='testClass' onClick={mockClickHandler} >
          <div>child</div>
        </SafeExit>
      </SafeExitWrapper>
    );

    const safeExit = getByTestId('safeExit');
    expect(safeExit.getAttribute('class')).toContain('testClass');

    fireEvent.click(safeExit);
    expect(mockClickHandler).toHaveBeenCalled();
    expect(mockOpenModal).toHaveBeenCalledWith('/test');
  });

  it('uses default values for props not defined', () => {
    const { getByTestId } = render(
      <SafeExitWrapper>
        <SafeExit>
          <div>child</div>
        </SafeExit>
      </SafeExitWrapper>
    );

    const safeExit = getByTestId('safeExit');
    expect(safeExit.getAttribute('class')).not.toContain('testClass');

    fireEvent.click(safeExit);
    expect(mockClickHandler).not.toHaveBeenCalled();
    expect(mockOpenModal).toHaveBeenCalledWith('/');
  });

  it('navigates to href when Enter key is pressed', () => {
    const { getByTestId } = render(
      <SafeExitWrapper>
        <SafeExit href='/test' onClick={mockClickHandler}>
          <div>child</div>
        </SafeExit>
      </SafeExitWrapper>
    );

    const safeExit = getByTestId('safeExit');

    fireEvent.keyDown(safeExit, { key: 'Enter', code: 'Enter' });
    expect(mockClickHandler).toHaveBeenCalled();
    expect(mockOpenModal).toHaveBeenCalledWith('/test');
  });

  it('navigates to href when Space key is pressed', () => {
    const { getByTestId } = render(
      <SafeExitWrapper>
        <SafeExit href='/test' onClick={mockClickHandler}>
          <div>child</div>
        </SafeExit>
      </SafeExitWrapper>
    );

    const safeExit = getByTestId('safeExit');

    fireEvent.keyDown(safeExit, { key: ' ', code: 'Space' });
    expect(mockClickHandler).toHaveBeenCalled();
    expect(mockOpenModal).toHaveBeenCalledWith('/test');
  });
});
