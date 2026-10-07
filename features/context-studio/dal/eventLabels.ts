import { AuditRecordEvent, AuditRecordEventLabels } from '@/features/shared/types/audit-record';
import { NAV_EVENTS } from '@/features/context-studio/constants/event-categories';

// Client navigation descriptions look like: User clicked "Label (/path)".
// This pulls out the label and href so a nav step can be titled by its page.
const NAV_DESCRIPTION = /User clicked "(.+?)(?: \((.+?)\))?"/;

export type DescribedEvent = {
  label: string;
  href: string | null;
  isNavigation: boolean;
};

// Turns one audit record into a display label + optional href. Navigations are
// titled by their destination page (parsed from the description); every other
// event is titled by its human-readable event label. Shared by every Context
// Studio behavior view so a step reads identically in Activity, Session paths
// and Page transitions.
export function describeEvent(event: string, description: string | null): DescribedEvent {
  if (NAV_EVENTS.has(event)) {
    const match = description?.match(NAV_DESCRIPTION);
    return {
      label: match ? match[1].trim() : 'Navigation',
      href: match?.[2]?.trim() ?? null,
      isNavigation: true,
    };
  }
  return {
    label: AuditRecordEventLabels[event as AuditRecordEvent] ?? event,
    href: null,
    isNavigation: false,
  };
}

// Drops a step whose label matches the previous step's, so a session that
// re-fires the same page (Library > Library > Document) signs the same path as
// one that doesn't (Library > Document). This is the biggest legibility win for
// path grouping: it lets genuinely-identical journeys merge into one lane.
export function collapseConsecutiveRepeats<T extends { label: string }>(steps: T[]): T[] {
  const out: T[] = [];
  for (const step of steps) {
    if (out.length > 0 && out[out.length - 1].label === step.label) { continue; }
    out.push(step);
  }
  return out;
}
