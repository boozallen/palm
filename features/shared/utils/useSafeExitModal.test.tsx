import { renderHook } from '@testing-library/react';

import { useRouter } from 'next/router';
import { useSafeExitModal } from './useSafeExitModal';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

describe('useSafeExitModal', () => {
  it('should return an object with four properties', () => {
    (useRouter as jest.Mock).mockReturnValue({ push: jest.fn() });
    const { result } = renderHook(useSafeExitModal);
    expect(result.current).toHaveProperty('setSafeExitFormToDirty');
    expect(result.current).toHaveProperty('SafeExitModal');
    expect(result.current).toHaveProperty('SafeExitProvider');
    expect(result.current).toHaveProperty('openModal');
  });

  it('should open modal when openModal is called', () => {
    const router = { push: jest.fn() };
    (useRouter as jest.Mock).mockReturnValue(router);
    const { result } = renderHook(useSafeExitModal);
    result.current.openModal('/test');
    expect(router.push).toBeCalledWith('/test');
  });
});

