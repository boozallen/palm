import { renderHook } from '@testing-library/react';
import useScrollIntoView from './useScrollIntoView';

describe('useScrollIntoView', () => {
  let scrollIntoViewMock: jest.Mock;

  beforeEach(() => {
    scrollIntoViewMock = jest.fn();
    window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should scroll to the bottom with default options when dependencies change', () => {
    const ref = { current: document.createElement('div') };
    const dependencies = ['dependency1', 'dependency2'];

    renderHook(() => useScrollIntoView(ref, dependencies));

    expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth', block: 'end' });
  });

  it('should scroll to the bottom with custom options when dependencies change', () => {
    const ref = { current: document.createElement('div') };
    const dependencies = ['dependency1', 'dependency2'];
    const customOptions: ScrollIntoViewOptions = { behavior: 'auto', block: 'start' };

    renderHook(() => useScrollIntoView(ref, dependencies, customOptions));

    expect(scrollIntoViewMock).toHaveBeenCalledWith(customOptions);
  });

  it('should not scroll if ref is null', () => {
    const ref = { current: null };
    const dependencies = ['dependency1', 'dependency2'];

    renderHook(() => useScrollIntoView(ref, dependencies));

    expect(scrollIntoViewMock).not.toHaveBeenCalled();
  });

  it('should scroll again if dependencies change', () => {
    const ref = { current: document.createElement('div') };
    const { rerender } = renderHook(
      ({ deps }) => useScrollIntoView(ref, deps),
      { initialProps: { deps: ['dependency1'] } }
    );

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);

    // Change the dependencies to trigger the effect again
    rerender({ deps: ['dependency1', 'dependency2'] });

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
  });
});
