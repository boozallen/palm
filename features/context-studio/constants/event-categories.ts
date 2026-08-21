import {
  IconArrowUpCircle,
  IconBrandGithub,
  IconLogin,
  IconLogout,
  IconPointer,
  IconRoute,
  IconShare,
} from '@tabler/icons-react';
import { AuditRecordEvent } from '@/features/shared/types/audit-record';

// Single source of truth for how every AuditRecord event is grouped, iconed,
// and colored across all Context Studio behavior views (Activity, Session
// paths, Page transitions, User activity). Categories are a display concern
// only — they do not change how records are written.
//
// Color note: category hues are drawn from the validated data-viz dark palette,
// but color is deliberately NOT the sole identity channel. Every category ships
// a distinct icon and a text label, so a colorblind reader (or a grayscale
// print) never has to tell two categories apart by hue alone. Navigation and
// Control share the route family of intent but carry different icons for the
// same reason. See the data-viz skill's secondary-encoding rule.

export enum EventCategory {
  Session = 'session',
  Navigation = 'navigation',
  Control = 'control',
  ContentSharing = 'contentSharing',
  Governance = 'governance',
  IntegrationsData = 'integrationsData',
}

// A Tabler icon component, typed off a concrete icon so we never depend on the
// (unexported) TablerIconsProps type.
export type CategoryIcon = typeof IconRoute;

export type CategoryMeta = {
  category: EventCategory;
  label: string;
  icon: CategoryIcon;
  // Mantine theme color name, used for Badge/ThemeIcon/Timeline color props.
  color: string;
  // Resolved hex, used where a raw SVG fill/stroke is needed (flow map, strips).
  // Validated on the dark chart surface; see event-categories validation note.
  hex: string;
};

// Session sign-in/sign-out gets its own icon at render time (login vs logout);
// the map holds the sign-in icon as the category default.
export const CATEGORY_META: Record<EventCategory, CategoryMeta> = {
  [EventCategory.Session]: {
    category: EventCategory.Session,
    label: 'Session',
    icon: IconLogin,
    color: 'gray',
    hex: '#909296',
  },
  [EventCategory.Navigation]: {
    category: EventCategory.Navigation,
    label: 'Navigation',
    icon: IconRoute,
    color: 'blue',
    hex: '#3987e5',
  },
  [EventCategory.Control]: {
    category: EventCategory.Control,
    label: 'Control',
    icon: IconPointer,
    color: 'dark',
    hex: '#6c6f75',
  },
  [EventCategory.ContentSharing]: {
    category: EventCategory.ContentSharing,
    label: 'Content and sharing',
    icon: IconShare,
    color: 'teal',
    hex: '#199e70',
  },
  [EventCategory.Governance]: {
    category: EventCategory.Governance,
    label: 'Governance',
    icon: IconArrowUpCircle,
    color: 'grape',
    hex: '#9085e9',
  },
  [EventCategory.IntegrationsData]: {
    category: EventCategory.IntegrationsData,
    label: 'Integrations and data',
    icon: IconBrandGithub,
    color: 'orange',
    hex: '#d95926',
  },
};

// Events carrying a client navigation. NAVIGATION is the authoritative enum
// member the client route writes today; UI_INTERACTION is a legacy value that
// carried the same `User clicked "Label (/path)"` description before the rename,
// kept here so historical rows still classify as navigation-family.
export const NAV_EVENTS = new Set<string>([AuditRecordEvent.Navigation, 'UI_INTERACTION']);

// Non-navigation events grouped by category. Navigation has no set of its own:
// a nav-family event is split at runtime by href presence.
const CONTENT_SHARING_EVENTS = new Set<string>([
  AuditRecordEvent.ToggleDocumentLibraryDataSharing,
  AuditRecordEvent.ShareDocumentLibraryData,
  AuditRecordEvent.ReshareDocumentLibraryData,
  AuditRecordEvent.UpdateDocumentShares,
  AuditRecordEvent.AcceptDocumentLibraryDataShare,
  AuditRecordEvent.RejectDocumentLibraryDataShare,
  AuditRecordEvent.ShareWorkflow,
  AuditRecordEvent.ReshareWorkflow,
  AuditRecordEvent.UpdateWorkflowShares,
  AuditRecordEvent.AcceptWorkflowShare,
  AuditRecordEvent.RejectWorkflowShare,
]);

const GOVERNANCE_EVENTS = new Set<string>([
  AuditRecordEvent.PromoteDocumentToAdminDataSource,
  AuditRecordEvent.DemoteDocumentFromAdminDataSource,
  AuditRecordEvent.PromoteDocumentCollectionToAdminDataSource,
  AuditRecordEvent.DemoteDocumentCollectionFromAdminDataSource,
  AuditRecordEvent.CreateUserGroup,
  AuditRecordEvent.DeleteUserGroup,
  AuditRecordEvent.CreateUserGroupMembership,
  AuditRecordEvent.DeleteUserGroupMembership,
  AuditRecordEvent.ModifyUserGroupMembershipRole,
  AuditRecordEvent.ModifyUserRole,
  AuditRecordEvent.ModifyAccount,
  AuditRecordEvent.CreateUser,
  AuditRecordEvent.AcknowledgeSecurityPolicy,
  AuditRecordEvent.RequestAccessToPalm,
]);

const INTEGRATIONS_DATA_EVENTS = new Set<string>([
  AuditRecordEvent.ConfigureGithubProvider,
  AuditRecordEvent.PublishArtifactToGithub,
  AuditRecordEvent.PublishWorkflowArtifactToGithub,
  AuditRecordEvent.ExecutePostgresqlQuery,
  AuditRecordEvent.ExecuteNeo4jQuery,
]);

const SESSION_EVENTS = new Set<string>([
  AuditRecordEvent.UserSignIn,
  AuditRecordEvent.UserSignOut,
]);

// On-screen-only interactions: Controls by name rather than by falling through
// to the default, so the classification survives a change to the fallback.
const CONTROL_EVENTS = new Set<string>([
  AuditRecordEvent.TogglePanel,
  AuditRecordEvent.HighlightResponseText,
]);

// Classifies one event into its category. `hasHref` disambiguates the
// nav-family events: with an href it is a Navigation, without one a Control.
export function categorize(event: string, hasHref: boolean): EventCategory {
  if (NAV_EVENTS.has(event)) {
    return hasHref ? EventCategory.Navigation : EventCategory.Control;
  }
  if (CONTROL_EVENTS.has(event)) { return EventCategory.Control; }
  if (SESSION_EVENTS.has(event)) { return EventCategory.Session; }
  if (CONTENT_SHARING_EVENTS.has(event)) { return EventCategory.ContentSharing; }
  if (GOVERNANCE_EVENTS.has(event)) { return EventCategory.Governance; }
  if (INTEGRATIONS_DATA_EVENTS.has(event)) { return EventCategory.IntegrationsData; }
  // Unmapped events fall back to Control so a new event type is never invisible.
  return EventCategory.Control;
}

export const categoryMeta = (category: EventCategory): CategoryMeta => CATEGORY_META[category];

// The icon for a specific event, honoring the login/logout split within Session.
export function eventIcon(event: string, hasHref: boolean): CategoryIcon {
  if (event === AuditRecordEvent.UserSignOut) { return IconLogout; }
  return CATEGORY_META[categorize(event, hasHref)].icon;
}
