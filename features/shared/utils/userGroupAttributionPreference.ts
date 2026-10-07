import { UiPreference } from '@/types/ui-preferences';

export type UserGroupAttributionPreference = {
  userGroupId: string;
};

export function readUserGroupAttributionPreference(): UserGroupAttributionPreference | null {
  const raw = localStorage.getItem(UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.userGroupId !== 'string') {
      return null;
    }
    return { userGroupId: parsed.userGroupId };
  } catch {
    return null;
  }
}

export function writeUserGroupAttributionPreference(preference: UserGroupAttributionPreference): void {
  localStorage.setItem(UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE, JSON.stringify(preference));
}

export function clearUserGroupAttributionPreference(): void {
  localStorage.removeItem(UiPreference.USER_GROUP_ATTRIBUTION_PREFERENCE);
}
