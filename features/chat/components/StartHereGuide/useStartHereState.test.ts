import { act, renderHook } from '@testing-library/react';

import useStartHereState from './useStartHereState';
import { UiPreference } from '@/types/ui-preferences';

describe('useStartHereState', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('auto-expands and marks seen on first visit when nothing is stored', () => {
    const { result } = renderHook(() => useStartHereState());

    expect(result.current.expanded).toBe(true);
    expect(result.current.hasSeen).toBe(true);
    expect(localStorage.getItem(UiPreference.START_HERE_GUIDE_SEEN)).toBe('true');
  });

  it('hydrates hasSeen from localStorage', () => {
    localStorage.setItem(UiPreference.START_HERE_GUIDE_SEEN, 'true');

    const { result } = renderHook(() => useStartHereState());

    expect(result.current.hasSeen).toBe(true);
    expect(result.current.expanded).toBe(false);
  });

  it('expand() opens the sequence and persists the seen flag', () => {
    const { result } = renderHook(() => useStartHereState());

    act(() => result.current.expand());

    expect(result.current.expanded).toBe(true);
    expect(result.current.hasSeen).toBe(true);
    expect(localStorage.getItem(UiPreference.START_HERE_GUIDE_SEEN)).toBe('true');
  });

  it('collapse() closes the sequence but leaves hasSeen set', () => {
    const { result } = renderHook(() => useStartHereState());

    act(() => result.current.expand());
    act(() => result.current.collapse());

    expect(result.current.expanded).toBe(false);
    expect(result.current.hasSeen).toBe(true);
  });

  it('does not auto-expand when disabled', () => {
    const { result } = renderHook(() => useStartHereState({ enabled: false }));

    expect(result.current.expanded).toBe(false);
    expect(localStorage.getItem(UiPreference.START_HERE_GUIDE_SEEN)).toBeNull();
  });
});
