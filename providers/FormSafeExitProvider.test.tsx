import { useContext } from 'react';
import { render } from '@testing-library/react';
import { useRouter } from 'next/router';
import FormSafeExitProvider from './FormSafeExitProvider';
import { SafeExitContext } from '@/features/shared/utils';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

const FirstChildComponent = () => {
  const { setSafeExitFormToDirty, openModal } = useContext(SafeExitContext);

  return (
    <div data-dirty={typeof setSafeExitFormToDirty} data-modal={typeof openModal} >
      One
    </div>
  );
};

describe('FormSafeExitProvider', () => {
  const router: any = { 
    push: jest.fn(),
    pathname: '/',
  };

  it('provides expected AppSafeExitContext to child components', () => {
    (useRouter as jest.Mock).mockReturnValue(router);
    const { getByText } = render(
      <FormSafeExitProvider>
        <FirstChildComponent />
      </FormSafeExitProvider>
    );
    const firstChild = getByText('One');
    expect(firstChild.getAttribute('data-dirty')).toBe('function');
    expect(firstChild.getAttribute('data-modal')).toBe('function');
  });
});
