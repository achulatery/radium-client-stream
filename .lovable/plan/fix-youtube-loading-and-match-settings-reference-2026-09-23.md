# Fix YouTube loading and match Settings reference

## What will change

- Make a selected video appear immediately, without waiting for Invidious metadata or comments.
- Load optional metadata and comments in the background with short request limits; failures will not stop or replace the player.
- Add clear player-ready and player-error states so the screen cannot remain indefinitely on “Loading”.
- Replace the current stacked Settings controls with the attached reference’s lightweight full-width rows:
  - Transport selector
  - Wisp server field
  - Home page field
  - HTTP cache switch
  - Dark/light interface control
  - Compact client-colour swatches
- Preserve the Browser, YouTube, and Settings menus, existing themes, custom theme storage, history, and branding.

## Technical details

- Decouple `openVideo` from the Invidious requests and guard background responses against stale selections.
- Reduce upstream instance timeouts and race candidates in parallel instead of waiting sequentially.
- Keep `youtube-nocookie.com` playback independent of third-party API availability.
- Extend persisted settings only for the controls visible in the reference.
- Validate with type checking and browser tests covering video selection, failed metadata calls, and the Settings layout at the current viewport.
