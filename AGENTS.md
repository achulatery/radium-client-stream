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
