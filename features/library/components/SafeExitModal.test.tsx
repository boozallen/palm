import SafeExitModal from './SafeExitModal';
import { fireEvent, render } from '@testing-library/react';

describe('SafeExitModal', () => {
  const onLeave = jest.fn();
  const onCancel = jest.fn();

  afterEach(() => {
    onLeave.mockReset();
    onCancel.mockReset();
  });

  const renderSafeExitModal = (isOpen: boolean) => {
    const { getByText, queryByText } = render(
      <SafeExitModal isOpen={isOpen} onLeave={onLeave} onCancel={onCancel} />
    );
    return { getByText, queryByText };
  };

  it('renders SafeExitModal', () => {
    const { getByText } = renderSafeExitModal(true);
    expect(getByText('Yes, Leave').textContent).toBe('Yes, Leave');
  });

  it('does not render SafeExitModal', () => {
    const { queryByText } = renderSafeExitModal(false);
    expect(queryByText('Yes, Leave')).toBeNull();
  });

  it('calls onLeave', () => {
    const { getByText } = renderSafeExitModal(true);
    fireEvent.click(getByText('Yes, Leave'));
    expect(onLeave).toBeCalled();
  });

  it('calls onCancel', () => {
    const { getByText } = renderSafeExitModal(true);
    fireEvent.click(getByText('Cancel'));
    expect(onCancel).toBeCalled();
  });
});

