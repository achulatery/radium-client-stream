# Fix Google/YouTube search 404

## What is happening

The proxy rewrites YouTube and Google links/forms once on the server, then the browser patch can wrap those already-proxied URLs a second time. For search forms, the search terms are also being added to the outer proxy URL instead of the real Google/YouTube destination. That can send Google a malformed destination and produce Google’s own “URL not found” page.

The parent window currently receives navigation messages but only updates the address text; it does not take ownership of loading the requested page. The cookie fallback can also be overwritten by images or other background requests, making recovery unreliable.

## Changes

1. **Prevent double proxying**
   - Recognize both relative and absolute Radium proxy URLs as already proxied.
   - Add one shared browser-side helper that unwraps the real destination from an existing `?u=` URL before navigation.

2. **Correct search form destinations**
   - Build GET form searches against the unwrapped Google/YouTube action URL.
   - Add form fields to the upstream URL, then proxy that completed URL exactly once.
   - Preserve repeated form fields rather than replacing them incorrectly.

3. **Make Radium control navigation**
   - When a proxied page reports a navigation, update and reload the iframe from the parent with the clean upstream URL.
   - Keep the iframe fallback proxied, while avoiding duplicate navigation races.
   - Validate message origins and accept only well-formed HTTP(S) destinations.

4. **Harden escaped-navigation recovery**
   - Stop background assets and API calls from overwriting the navigation fallback cookie.
   - Set the fallback only for HTML document responses and guard malformed fallback values.
   - Preserve query strings when recovering an escaped Google/YouTube path.

5. **Verify the exact failure path**
   - Test opening YouTube, searching through YouTube’s own search box, opening a result, and using back/forward.
   - Test Google search inside the proxy and direct searches from Radium’s address bar.
   - Confirm there are no Google 404 pages, Radium 404 pages, double-wrapped proxy URLs, or new browser errors.
