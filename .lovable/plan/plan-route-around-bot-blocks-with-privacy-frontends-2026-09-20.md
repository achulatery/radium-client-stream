# Plan: Route around bot blocks with privacy frontends

The bot-check walls (YouTube "sign in to prove you're not a bot", DuckDuckGo blocks) happen because requests come from a datacenter IP that these sites distrust. This plan routes search and video traffic to privacy-focused alternative frontends instead of the main sites.

## What changes

### 1. Search goes through a SearXNG instance
- Update `normalizeQuery()` in `src/lib/radium.tsx`: non-URL input becomes `https://searx.be/search?q=<query>` instead of `html.duckduckgo.com`.
- SearXNG is an open metasearch engine with no bot checks; results load through the existing proxy inside Radium.
- If searx.be is unreliable, add a small ordered fallback list of public instances (searx.be, search.brave4u-style alternates not needed — keep a short constant list) — first instance is the default; no auto-retry complexity.

### 2. YouTube videos route to Invidious / Piped player pages
- Keep the existing `getYouTubeVideoId()` extraction (already handles youtu.be, /watch?v=, /shorts/, /live/).
- Replace `youtubeEmbedUrl(videoId)` with an Invidious embed: `https://yewtu.be/embed/<VIDEO_ID>` (fallback constant list: yewtu.be first, then piped.video watch URL if needed — single default, no retry logic).
- This page is designed for datacenter traffic and does not show the Google bot wall.

### 3. Videos open in a clean new tab; pages stay inside Radium
- Video links (anything with a YouTube video ID): open the Invidious/Piped URL via `window.open(url, "_blank", "noopener")`, show an on-screen "Open player ↗" link as fallback if the popup is blocked, and set status to "Player opened in a new tab". No iframe for videos at all — removes the iframe connection-security errors.
- Everything else (searches, regular sites): stays inside Radium through the existing proxy as it does now.

## Files
- `src/lib/radium.tsx` — search target URL constant.
- `src/routes/index.tsx` — video handling: replace the YouTube embed iframe with the new-tab player flow + fallback link; keep the proxied iframe for non-video URLs.

## Technical notes
- Constants: `SEARCH_URL = "https://searx.be/search?q="`, `PLAYER_URL = (id) => "https://yewtu.be/embed/" + id`.
- No changes to the proxy route, theme system, settings, or layout.
- Verify with Playwright: a search query loads searx.be results inside Radium; a YouTube watch/shorts URL opens the yewtu.be player in a new tab; typecheck passes.
