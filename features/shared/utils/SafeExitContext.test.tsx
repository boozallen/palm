import { useContext } from 'react';
import { renderHook } from '@testing-library/react';
import { SafeExitContext } from './SafeExitContext';

describe('SafeExitProvider', () => {
  it('provides expected SafeExitContext to child components', () => {
    const { result } = renderHook(() => useContext(SafeExitContext));
    expect(typeof result.current.setSafeExitFormToDirty).toBe('function');
    expect(typeof result.current.openModal).toBe('function');
  });

});

