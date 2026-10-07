# Radium Client

https://github.com/MercuryWorkshop/scramjet.git Build a web proxy application called "Radium Client" with a Google Search-inspired interface, optimized for video streaming and network compatibility testing.

Visual Design & Theme System

Customizable Themes:

Color pickers for: background, text, accent, search bar, buttons

Unlimited custom theme saves to localStorage

Preset themes: Google White, Midnight Dark, Ocean Blue, Cyberpunk Neon, Forest Green, Sunset Orange

Real-time theme preview

Layout:

Google-style homepage: centered logo, search bar, two buttons

Toggle to toolbar mode (address bar at top)

Minimalist footer with settings link

Core Proxy Functionality

YouTube & Video Support:

Proxy video streams with proper HTTP range requests (206 Partial Content) for seeking

Handle video CDN domains: googlevideo.com, ytimg.com

Support MP4, WebM, HLS (.m3u8) formats

Adaptive bitrate streaming

Load thumbnails, channel avatars, comments, related videos

Regional Configuration:

Proxy Region: Singapore-based exit nodes/IP addresses

Route all traffic through Singapore servers for optimal Asia-Pacific connectivity

Singapore timezone display option

Regional content unlocking for Singapore-available services

Technical Implementation:

Header forwarding: User-Agent, Referer, Accept, Accept-Encoding, Accept-Language

Cookie handling for session persistence

URL rewriting: href, src, action attributes in HTML/CSS/JS

WebSocket support for real-time features

iframe sandbox container for content isolation

Features:

Ping Counter: Live latency display (ms) in top-right corner, color-coded (green <100ms, yellow <300ms, red >300ms)

Address Bar: Shows proxied URL, allows direct navigation

Navigation: Back/forward/refresh buttons

History: Recently visited sites (localStorage)

Stealth Mode: Randomized user-agent rotation option

Stack:

React frontend with dynamic CSS-in-JS theming

Express.js proxy backend deployed in Singapore region

Service worker for request handling

Focus on smooth video playback, Singapore-based routing, and clean, customizable UI. and add a below the branding by James Xie

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://singapore-stream-proxy.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/0ac4232a-87a7-48a5-97f8-52e514de78bd).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
