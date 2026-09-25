# Fix Google video proxy failures

## Changes
- Keep YouTube playback inside the Radium interface, but load the official privacy player directly rather than routing its signed media chunks through the edge proxy.
- Continue using the proxy for ordinary websites and searches.
- Add bounded upstream request handling and a readable media failure response so an unreachable upstream cannot hang indefinitely.
- Verify a YouTube watch URL no longer sends `googlevideo.com` requests through `/api/public/p`, and verify an ordinary proxied page still loads.

## Technical details
- In the Browser tab, choose the direct `youtube-nocookie.com/embed/<id>` URL only for recognized YouTube watch, Shorts, live, and shortened links.
- Keep `/api/public/p` for non-video targets.
- Add an abort timeout to the proxy fetch and preserve streamed bodies and Range responses.
