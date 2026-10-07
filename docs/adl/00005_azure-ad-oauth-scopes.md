# ADR 5: Configurable Azure AD OAuth Scopes

## Context

`AzureADProvider`'s OAuth scope was previously hardcoded in `server/auth-config.ts` to the string `'openid profile email'`. These three scopes follow the [Microsoft identity platform's OpenID Connect scopes](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc) and are the minimum needed for sign-in:

- `openid` establishes the sign-in request and returns the user's unique identifier in the `sub` claim. Required to acquire an ID token at all.
- `profile` returns claims such as given name, surname, and preferred username, used to populate the user's display name.
- `email` returns the user's primary email claim, used to match and provision the account.

Some deployments need to request additional [Microsoft Graph delegated permissions](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-and-permissions) (e.g. `Sites.Read.All`, `Files.Read.All`, `GroupMember.Read.All`) so a future feature can call Graph on the user's behalf. Hardcoding the scope string meant every such change required a code change and deploy.

## Decision

We will store the requested Azure AD scopes in `SystemConfig.azureAdScopes` (`String[]`, default `["openid", "profile", "email"]`) and read them at provider construction time:

- `getAzureAdScopes()` in `server/auth-config.ts` queries `SystemConfig` and falls back to the OIDC default scopes if no override is stored or the query fails.
- `getAzureADProvider()` becomes async so it can await the scope list before constructing `AzureADProvider`, and `getEnabledProviders()` is updated to await all provider factories.
- Admins manage the list from **Settings → System → Authentication - Azure AD** (`AzureAdScopesTable`/`AzureAdScopesConfigRow`), backed by the existing `updateSystemConfig` mutation (`SystemConfigFields.AzureAdScopes`).
- The scope picker (`MultiSelect`) is constrained to a curated `AVAILABLE_SCOPES` list rather than freeform text, to avoid admins requesting arbitrary/misspelled Graph permissions.
- `openid`, `profile`, and `email` are flagged with a **Required** badge in the picker and in an info popover that documents each scope's service (OpenID Connect vs. Microsoft Graph), description, and the concrete feature it enables — sourced from the Microsoft identity platform docs above and from what the code actually does (see Consequences).

## Status

Accepted

## Consequences

### Positive Consequences

- New Graph scopes can be requested by an admin from the UI, without a deploy, once a feature that consumes them ships.
- The info popover gives admins a scope-by-scope reference (service, description, effect) instead of requiring them to look up Microsoft's docs.
- Falling back to the OIDC default scopes on a missing/failed `SystemConfig` read means a bad or empty DB value can't fully lock out sign-in.

### Negative Consequences

- `Sites.Read.All`, `Files.Read.All`, and `GroupMember.Read.All` are exposed as selectable scopes today but are **not consumed by any feature yet** — no code in the repo calls Microsoft Graph. Selecting them requests broader user consent for no current functional benefit. The UI labels these as "Reserved... not yet implemented" to set expectations.
- `getAzureAdScopes()` returns whatever list is stored verbatim once it's non-empty — it does not re-add `openid`/`profile`/`email` if an admin removes them from the picker. Removing a required scope will break Azure AD sign-in for all users on that tenant until corrected. This is an accepted risk for now; enforcing required scopes server-side is a candidate follow-up.
- Role inheritance (`INHERITED_OAUTH_ROLE_PATH` → `getOAuthRole()`) reads claims already present on the ID token/profile response, not a live Graph `/memberOf` call — so granting `GroupMember.Read.All` does not currently change role-inheritance behavior.

## References

- [Scopes and permissions in the Microsoft identity platform](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-and-permissions)
- [Scopes, permissions, and consent in the Microsoft identity platform (OIDC scopes)](https://learn.microsoft.com/en-us/entra/identity-platform/scopes-oidc)
- [AzureAD provider configuration](../auth/AzureAD.md)

## Appendix

### Files Modified

- `prisma/schema.prisma` — `SystemConfig.azureAdScopes`
- `server/auth-config.ts` — `getAzureAdScopes()`, async `getAzureADProvider()`/`getEnabledProviders()`
- `features/settings/components/system-configurations/tables/AzureAdScopesTable.tsx` — table shell, header
- `features/settings/components/system-configurations/tables/AzureAdScopesConfigRow.tsx` — scope picker, Required/service badges, info popover
