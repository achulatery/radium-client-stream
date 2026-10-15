import hits from "@/assets/spotify-todays-hits.jpg.asset.json";
import rap from "@/assets/spotify-rapcaviar.jpg.asset.json";
import chill from "@/assets/spotify-chill.jpg.asset.json";
import decade from "@/assets/spotify-all-out.jpg.asset.json";
import rock from "@/assets/spotify-rock.jpg.asset.json";
import indie from "@/assets/spotify-indie.jpg.asset.json";

export type SpotifyItem = { id: string; type: string; title: string; subtitle: string; artwork?: string };
export const spotifyPicks: SpotifyItem[] = [
  { id: "37i9dQZF1DXcBWIGoYBM5M", type: "playlist", title: "Today’s Top Hits", subtitle: "The biggest songs right now", artwork: hits.url },
  { id: "37i9dQZF1DX0XUsuxWHRQd", type: "playlist", title: "RapCaviar", subtitle: "Hip-hop’s heavy hitters", artwork: rap.url },
  { id: "37i9dQZF1DX4WYpdgoIcn6", type: "playlist", title: "Chill Hits", subtitle: "Kick back and unwind", artwork: chill.url },
  { id: "37i9dQZF1DX5Ejj0EkURtP", type: "playlist", title: "All Out 2010s", subtitle: "A decade of your favorites", artwork: decade.url },
  { id: "37i9dQZF1DWXRqgorJj26U", type: "playlist", title: "Rock Classics", subtitle: "Legendary riffs. Timeless tracks.", artwork: rock.url },
  { id: "37i9dQZF1DWWEcRhUVtL8n", type: "playlist", title: "Indie Pop", subtitle: "A fresh sound for your day", artwork: indie.url },
];

export function parseSpotifyLink(value: string): SpotifyItem | null {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "open.spotify.com") return null;
    const match = url.pathname.match(/^\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([a-zA-Z0-9]{22})\/?$/);
    if (!match?.[1] || !match[2]) return null;
    return spotifyPicks.find((item) => item.id === match[2]) ?? { type: match[1], id: match[2], title: `Spotify ${match[1]}`, subtitle: "Opened from your link" };
  } catch { return null; }
}

export const spotifyUrl = (item: SpotifyItem) => `https://open.spotify.com/${item.type}/${item.id}`;