<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

Radium's Home Screen entry is rooted at `/` through the web manifest, and Piped API calls must bypass caches and validate JSON responses; this prevents stale or HTML responses from masquerading as video data.

Use the shared VideoThumbnail for both video result grids; viewport-aware preloading keeps scrolling smooth without fetching every result at once.

Client colour swatches update both accent roles together, and both interface-mode controls use the provider's toggleMode to preserve the chosen signal colours while changing surfaces.

Accounts are custom (app_users/app_activity tables, cookie session in src/lib/account.functions.ts), not Cloud Auth, because usernames are free-form; all access goes through server functions with the admin client, and "deleting" history only sets hidden=true.

Music uses the official SoundCloud widget and validated SoundCloud URLs; preserve provider-controlled playback and do not claim verified sign-in from popup closure.

Account authorization reads app_account_roles on the server, never the deprecated app_users.is_admin field; this separates protected owner/mod grants from user data.

Password changes and new signups use Worker-compatible PBKDF2 hashes, while login accepts legacy passwords; never return stored passwords to any client.

Shared chat uses cookie-authenticated server functions and app_chat_messages with server-only table access; this keeps messages restricted to active Radium accounts.

Account ranks are owner > admin > mod in app_account_roles; checks live in src/lib/account-permissions.ts and staff can never act on equal or higher ranks, so rank rules stay in one place.

Chat rooms are joined by code and membership persists in app_room_members; deleted messages are soft-deleted with the deleter's rank so staff can still review them.
Public visibility lives on app_chat_rooms.is_public and is checked in room lists and message access; creation authorization reuses shared server rank permissions, while code-only creation remains available to members.
All revocable menu names share REVOCABLE_TABS and revoked visited tabs unmount; this prevents hidden music playback and keeps Console validation aligned with navigation.

Server-only session helpers live in src/lib/account-session.server.ts and are imported dynamically from *.functions.ts, because importing server-only modules statically breaks the client bundle.

- Profiles (avatar as small resized data URL, bio max 20 words) live on app_users and are edited only via updateProfile; public cards via getProfile expose only image, description and creation date. Accounts with pin_hash require a hashed secondary PIN at sign-in; passwords and their hashes are never exposed in the Console.

Lazy-load secondary tabs on first visit and retain Browser, Chat and Console within the signed-in shell; this avoids unused startup work and repeated loading during tab switches.

Outgoing chat uses an immediate optimistic row reconciled by the saved message ID, a synchronous send lock and versioned reads; this prevents duplicate submissions and stale polling from replacing pending messages.

Console controls reuse shared rank permissions and accessible themed dropdowns; this preserves server authority while containing access actions and history within the workspace.

Console presence is approximate recent activity: a cookie-authenticated heartbeat updates last_seen every 30 seconds while the page is visible and Console refreshes its roster, with a 90-second expiry; this avoids exposing sessions or adding public table access.

SoundCloud repeat binds the official widget READY/FINISH events and replays through its API, while theme styling leaves provider-owned controls and branding intact; never replace it with extracted audio streams.

Menu entrance animations belong to visible tab wrappers and respect reduced motion; preserve mounted visited tabs so animations do not reset user state.
Proxy compatibility preserves incoming browser identity, translates upstream referrers and leaves consent intact instead of spoofing browser globals or rotating fingerprints; direct browser opening is the fallback for unsupported website checks.
Account history visibility uses canViewAccountHistory before querying activity; account mutations use rank and protected-owner checks so the Console and server enforce the same authority.
DuckDuckGo policy is rechecked against the cookie-authenticated account on the server, including image requests and upstream preference cookies; client controls cannot grant permission to disable Safe Search.
The Browser owns its navigation stack and accepts only same-origin messages from its current iframe; resource property setters and mutation handling keep dynamic images inside the proxy.
