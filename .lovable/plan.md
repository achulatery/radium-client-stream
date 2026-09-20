# Pin YouTube back to the Singapore region

## Why it happens

YouTube decides a visitor's country mostly from the internet address (IP) it sees. Radium's requests to YouTube leave from edge servers, and the edge location can shift — right now YouTube is seeing a Netherlands address, so it serves Dutch region content. A true Singapore-only exit would need a dedicated server hosted in Singapore, which this setup cannot guarantee. What we can do is send YouTube explicit region hints it does respect.

## Fix

1. **Force region hints on every proxied YouTube request** (`src/routes/api/public/p.ts`)
   - When the target host is youtube.com / m.youtube.com / music.youtube.com, append `gl=SG` and `hl=en` to the target URL if not already present.
   - Send a YouTube `PREF` preference cookie (`gl=SG&hl=en`) alongside the existing consent cookies for YouTube hosts.
   - `Accept-Language: en-SG,en;q=0.9` is already sent — keep it.

2. **Region-hint the direct player** (`src/routes/index.tsx`)
   - The watch/Shorts player loads YouTube's official player directly from the browser, so it follows the user's own region. Add `hl=en` to the embed URL and keep `gl=SG` behavior documented as best-effort (the embed follows the viewer's IP; only the in-proxy pages can be hinted).

3. **Redirect region switches back to SG**
   - In the proxy, when YouTube responds with a redirect to a different regional homepage or `?gl=XX`, rewrite the location to keep `gl=SG`.

## Verification

- Load `https://www.youtube.com` through the address bar and confirm the footer/settings country shows Singapore and trending titles match SG.
- Open a watch page and a Shorts page and confirm playback still works.

## Limitation (be upfront with user)

Region cannot be 100% pinned without a real Singapore server. These hints make YouTube consistently show Singapore for pages served through Radium; the embedded player may still reflect the viewer's actual connection.

## Technical notes

- `p.ts`: add `withSgRegion(url)` helper applied in the target-normalization step for YouTube hosts; extend the consent-cookie injection block to add `PREF`; adjust Location rewriting.
- `index.tsx`: one-line change to the embed `src`.
