import { renderWrapper } from '@/test/test-utils';
import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import StartHereSequence from './StartHereSequence';
import { STEP_CONTENT } from './steps/content';

let mockReducedMotion = true;

jest.mock('@mantine/hooks', () => ({
  ...jest.requireActual('@mantine/hooks'),
  useReducedMotion: () => mockReducedMotion,
}));

beforeEach(() => {
  mockReducedMotion = true;
});

describe('StartHereSequence', () => {
  it('starts on the first step with its title, caption, and Back disabled', () => {
    renderWrapper(<StartHereSequence onDone={jest.fn()} />);
    expect(screen.getByText(STEP_CONTENT.model.title)).toBeInTheDocument();
    expect(screen.getByText(STEP_CONTENT.model.caption)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back/i })).toBeDisabled();
  });

  it('advances through steps with Next', async () => {
    const user = userEvent.setup();
    renderWrapper(<StartHereSequence onDone={jest.fn()} />);

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(STEP_CONTENT.upload.title)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(STEP_CONTENT.ask.title)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText(STEP_CONTENT.answer.title)).toBeInTheDocument();
  });

  it('Back returns to the previous step', async () => {
    const user = userEvent.setup();
    renderWrapper(<StartHereSequence onDone={jest.fn()} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText(STEP_CONTENT.model.title)).toBeInTheDocument();
  });

  it('calls onDone from the Done button on the last step', async () => {
    const user = userEvent.setup();
    const onDone = jest.fn();
    renderWrapper(<StartHereSequence onDone={onDone} />);
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /next/i }));
    await user.click(screen.getByRole('button', { name: /done/i }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('exposes step progress via aria-label', () => {
    renderWrapper(<StartHereSequence onDone={jest.fn()} />);
    expect(screen.getByLabelText('Step 1 of 4')).toBeInTheDocument();
  });

  it('disables Next until the step animation completes, then enables it', () => {
    mockReducedMotion = false;
    jest.useFakeTimers();
    try {
      renderWrapper(<StartHereSequence onDone={jest.fn()} />);
      expect(screen.getByRole('button', { name: /next/i })).toBeDisabled();
      act(() => { jest.advanceTimersByTime(10000); });
      expect(screen.getByRole('button', { name: /next/i })).toBeEnabled();
    } finally {
      jest.useRealTimers();
    }
  });
});
