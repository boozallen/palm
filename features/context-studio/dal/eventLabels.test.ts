import { collapseConsecutiveRepeats, describeEvent } from './eventLabels';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

describe('describeEvent', () => {
  it('titles a navigation by its destination label and href', () => {
    expect(describeEvent(AuditRecordEvent.Navigation, 'User clicked "Chat (/chat)"')).toEqual({
      label: 'Chat',
      href: '/chat',
      isNavigation: true,
    });
  });

  it('parses the legacy UI_INTERACTION event the same way', () => {
    expect(describeEvent('UI_INTERACTION', 'User clicked "Prompt Library (/prompts)"')).toEqual({
      label: 'Prompt Library',
      href: '/prompts',
      isNavigation: true,
    });
  });

  it('keeps the label when a navigation carries no href', () => {
    expect(describeEvent(AuditRecordEvent.Navigation, 'User clicked "New chat"')).toEqual({
      label: 'New chat',
      href: null,
      isNavigation: true,
    });
  });

  it('falls back to a generic label for an unparseable navigation description', () => {
    expect(describeEvent(AuditRecordEvent.Navigation, null)).toEqual({
      label: 'Navigation',
      href: null,
      isNavigation: true,
    });
  });

  it('titles a non-navigation event by its human-readable event label', () => {
    expect(describeEvent(AuditRecordEvent.UserSignIn, null)).toEqual({
      label: 'User Sign In',
      href: null,
      isNavigation: false,
    });
  });

  it('falls back to the raw event name for an unmapped event', () => {
    expect(describeEvent('SOME_NEW_EVENT', null)).toEqual({
      label: 'SOME_NEW_EVENT',
      href: null,
      isNavigation: false,
    });
  });
});

describe('collapseConsecutiveRepeats', () => {
  it('drops a step whose label matches the previous step', () => {
    const steps = [
      { label: 'Library' },
      { label: 'Library' },
      { label: 'Document' },
    ];

    expect(collapseConsecutiveRepeats(steps)).toEqual([
      { label: 'Library' },
      { label: 'Document' },
    ]);
  });

  it('keeps a repeat that is not consecutive', () => {
    const steps = [
      { label: 'Chat' },
      { label: 'Library' },
      { label: 'Chat' },
    ];

    expect(collapseConsecutiveRepeats(steps)).toEqual(steps);
  });

  it('returns an empty list unchanged', () => {
    expect(collapseConsecutiveRepeats([])).toEqual([]);
  });
});
