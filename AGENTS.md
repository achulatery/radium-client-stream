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

Subdirectories have their own AGENTS.md (src/lib holds browser, proxy and chat-media rules); read it before changing files there.

Radium's Home Screen entry is rooted at `/` through the web manifest, and Piped API calls must bypass caches and validate JSON responses; this prevents stale or HTML responses from masquerading as video data.

Use the shared VideoThumbnail for both video result grids; viewport-aware preloading keeps scrolling smooth without fetching every result at once.

Client colour swatches update both accent roles together, and both interface-mode controls use the provider's toggleMode to preserve the chosen signal colours while changing surfaces.

Accounts are custom (app_users/app_activity tables, cookie session in src/lib/account.functions.ts), not Cloud Auth, because usernames are free-form; all access goes through server functions with the admin client, and "deleting" history only sets hidden=true.

Music uses the official SoundCloud widget and validated SoundCloud URLs; preserve provider-controlled playback and do not claim verified sign-in from popup closure.

Password changes and new signups use Worker-compatible PBKDF2 hashes, while login accepts legacy passwords; never return stored passwords to any client.

Shared chat uses cookie-authenticated server functions and app_chat_messages with server-only table access; this keeps messages restricted to active Radium accounts.

Account ranks are owner > contributor > admin > mod in app_account_roles (never app_users.is_admin); checks live in src/lib/account-permissions.ts and staff can never act on equal or higher ranks.

Chat rooms are joined by code and membership persists in app_room_members; deleted messages are soft-deleted with the deleter's rank so staff can still review them.
Public visibility lives on app_chat_rooms.is_public and is checked in room lists and message access; creation authorization reuses shared server rank permissions, while code-only creation remains available to members.
All revocable menu names share REVOCABLE_TABS and revoked visited tabs unmount; this prevents hidden music playback and keeps Console validation aligned with navigation.

Server-only session helpers live in src/lib/account-session.server.ts and are imported dynamically from *.functions.ts, because importing server-only modules statically breaks the client bundle.

- Profiles (avatar as small resized data URL, bio max 20 words) live on app_users and are edited only via updateProfile; public cards via getProfile expose image, description, creation date and rank tags. Accounts with pin_hash require a hashed secondary PIN at sign-in; password hashes are exposed in the Console to the owner only, never plaintext.

Lazy-load secondary tabs on first visit and retain Browser, Chat and Console within the signed-in shell; this avoids unused startup work and repeated loading during tab switches.

Outgoing chat uses an immediate optimistic row reconciled by the saved message ID, a synchronous send lock and versioned reads; this prevents duplicate submissions and stale polling from replacing pending messages.

Console controls reuse shared rank permissions and one Rank dropdown with separate account-role and chat-rank groups; this preserves separate server authority while keeping access actions available.

Console presence is approximate recent activity: a cookie-authenticated heartbeat updates last_seen every 30 seconds while the page is visible and Console refreshes its roster, with a 90-second expiry; this avoids exposing sessions or adding public table access.

SoundCloud repeat binds the official widget READY/FINISH events and replays through its API, while theme styling leaves provider-owned controls and branding intact; never replace it with extracted audio streams.

Menu entrance animations belong to visible tab wrappers and respect reduced motion; preserve mounted visited tabs so animations do not reset user state.
Account history visibility uses canViewAccountHistory (owner only) before querying activity, and activity rows auto-delete after 24 hours; account mutations use rank and protected-owner checks so the Console and server enforce the same authority. Only the owner can delete accounts.
Chat messages auto-delete 3 hours after creation, except the owner's: listMessages purges expired rows on every read and the hourly /api/public/jobs/cleanup schedule (authenticateCronRequest) is the backstop; never reintroduce permanent message retention.
Announcements and Updates are real chat rooms (codes announcements/updates) pinned above general; app_chat_rooms.read_only rooms accept messages only from canModerate staff, and only the owner toggles read_only. Staff moderation actions are logged to app_activity kind 'staff' so the owner sees them in Console history.
Mods can revoke menu access but cannot ban (canBan is owner/admin only); canRevokeTabs covers all staff.
Kleb has exactly one holder at a time: granting (grantKleb or ownerSetExtras) clears kleb_enabled from everyone else, staff and the holder view the page through getKlebPage, and only the holder edits it.
