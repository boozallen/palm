import { categorize, EventCategory, NAV_EVENTS } from './event-categories';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

describe('categorize', () => {
  it('classifies a nav-family event carrying an href as a Navigation', () => {
    expect(categorize(AuditRecordEvent.Navigation, true)).toBe(EventCategory.Navigation);
  });

  it('classifies a nav-family event with no href as a Control', () => {
    expect(categorize(AuditRecordEvent.Navigation, false)).toBe(EventCategory.Control);
  });

  it('classifies a panel toggle as a Control', () => {
    expect(categorize(AuditRecordEvent.TogglePanel, false)).toBe(EventCategory.Control);
  });

  // A panel toggle never carries an href, but the classification must not depend
  // on that: it is a Control either way.
  it('keeps a panel toggle a Control even if an href is somehow present', () => {
    expect(categorize(AuditRecordEvent.TogglePanel, true)).toBe(EventCategory.Control);
  });

  // The regression this event was introduced to prevent: panel toggles recorded
  // as href-less navigations were folded into the page-transition matrix and the
  // navigation counts, implying page views the user never made.
  it('keeps panel toggles out of the navigation-family event set', () => {
    expect(NAV_EVENTS.has(AuditRecordEvent.TogglePanel)).toBe(false);
  });

  it('classifies a response-text highlight as a Control', () => {
    expect(categorize(AuditRecordEvent.HighlightResponseText, false)).toBe(EventCategory.Control);
  });

  it('keeps response-text highlights out of the navigation-family event set', () => {
    expect(NAV_EVENTS.has(AuditRecordEvent.HighlightResponseText)).toBe(false);
  });

  it('classifies sign-in and sign-out as Session', () => {
    expect(categorize(AuditRecordEvent.UserSignIn, false)).toBe(EventCategory.Session);
    expect(categorize(AuditRecordEvent.UserSignOut, false)).toBe(EventCategory.Session);
  });

  it('classifies a share action as Content and sharing', () => {
    expect(categorize(AuditRecordEvent.ShareWorkflow, false)).toBe(EventCategory.ContentSharing);
  });

  it('classifies a role change as Governance', () => {
    expect(categorize(AuditRecordEvent.ModifyUserRole, false)).toBe(EventCategory.Governance);
  });

  it('classifies a GitHub publish as Integrations and data', () => {
    expect(categorize(AuditRecordEvent.PublishArtifactToGithub, false))
      .toBe(EventCategory.IntegrationsData);
  });

  it('falls back to Control so an unmapped event is never invisible', () => {
    expect(categorize('SOME_NEW_EVENT', false)).toBe(EventCategory.Control);
  });
});
