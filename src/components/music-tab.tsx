import { useEffect, useRef, useState } from "react";
import { ArrowRight, ExternalLink, Heart, Home, Library, LogIn, Menu, Music2, Play, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account";
import { track } from "@/lib/track";

type Track = { id: number; title: string; url: string; artist: string; artwork: string | null };
const initial: Track = { id: 0, title: "Daily mix", artist: "", url: "https://soundcloud.com/lofi_girl", artwork: null };
function soundcloudLink(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && /(^|\.)soundcloud\.com$/.test(url.hostname) ? url.toString() : null; } catch { return null; }
}
export function MusicTab() {
  const { user } = useAccount();
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<Track[]>([]);
  const [liked, setLiked] = useState<Track[]>([]);
  const [current, setCurrent] = useState(initial);
  const [view, setView] = useState<"home" | "liked">("home");
  const [collapsed, setCollapsed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const storageKey = `radium-soundcloud:${user?.id ?? "guest"}`;
  useEffect(() => { try { const saved = JSON.parse(localStorage.getItem(storageKey) ?? "[]"); setLiked(Array.isArray(saved) ? saved.filter((item) => item && typeof item.title === "string" && soundcloudLink(item.url)) : []); } catch { setLiked([]); } }, [storageKey]);
  const load = async (q = "") => {
    const token = ++request.current; setLoading(true); setError("");
    try {
      const response = await fetch(`/api/public/soundcloud?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      const data = await response.json();
      if (token !== request.current) return;
      if (!response.ok || !data.success || !Array.isArray(data.tracks)) throw new Error();
      setTracks(data.tracks.filter((item: Track) => soundcloudLink(item.url)));
    } catch { if (token === request.current) setError("Music is unavailable right now. You can still open a track link."); }
    finally { if (token === request.current) setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const pick = (item: Track) => { setCurrent(item); track("music", item.title, { source: "soundcloud", url: item.url }); };
  const toggleLike = () => { const active = liked.some((item) => item.url === current.url); const next = active ? liked.filter((item) => item.url !== current.url) : [current, ...liked]; setLiked(next); try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Storage may be unavailable. */ } track("music", current.title, { source: "soundcloud", preference: active ? "unlike" : "like" }); };
  const art = (item: Track, className = "") => item.artwork ? <img src={item.artwork} alt={item.title} className={className} loading="lazy" /> : <div className={`spotify-placeholder ${className}`}><Music2 size={26} /></div>;
  const isLiked = liked.some((item) => item.url === current.url);
  return <div className={`spotify-shell ${collapsed ? "is-collapsed" : ""}`}>
    <aside className="spotify-sidebar">
      <div className="spotify-navigation">
        <div className="spotify-brand"><span className="music-online" title="Online"><span className="music-online-dot" />{!collapsed && "Online"}</span><Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle library" title="Toggle library"><Menu /></Button></div>
        <Button variant="ghost" className="spotify-nav" title="Home" onClick={() => { setView("home"); setQuery(""); void load(); }}><Home />{!collapsed && "Home"}</Button>
        <Button variant="ghost" className="spotify-nav" title="Search" onClick={() => { setView("home"); input.current?.focus(); }}><Search />{!collapsed && "Search"}</Button>
        <Button variant="ghost" className="spotify-nav" title="Sign in" onClick={() => window.open("https://soundcloud.com/signin", "radium-music-signin", "width=480,height=720,noopener,noreferrer")}><LogIn />{!collapsed && "Sign in"}</Button>
      </div>
      <div className="spotify-library"><div className="spotify-library-heading"><Library />{!collapsed && <strong>Your Library</strong>}</div><Button variant="ghost" className="spotify-library-item" title="Liked music" onClick={() => setView("liked")}><span className="spotify-liked-art"><Heart /></span>{!collapsed && <span><strong>Liked music</strong><small>{liked.length} saved</small></span>}</Button>{liked.map((item) => <Button key={item.url} variant="ghost" className="spotify-library-item" onClick={() => pick(item)} title={item.title}>{art(item)}{!collapsed && <span><strong>{item.title}</strong><small>{item.artist}</small></span>}</Button>)}</div>
    </aside>
    <main className="spotify-main"><div className="spotify-main-content">
      <h1>{view === "liked" ? "Liked music" : "Music"}</h1>
      <form className="spotify-search" onSubmit={(event) => { event.preventDefault(); const value = query.trim(); if (!value) return; const link = soundcloudLink(value); if (link) { pick({ ...initial, title: "Selected music", url: link }); setError(""); return; } if (/^https?:/.test(value)) { setError("Enter a valid track, playlist or artist link."); return; } setView("home"); track("search", value, { source: "soundcloud" }); void load(value); }}><Search size={18} /><input ref={input} aria-label="Search music or paste a link" placeholder="Search music or paste a link" value={query} onChange={(event) => setQuery(event.target.value)} /><Button variant="ghost" size="icon" type="submit" aria-label="Search music"><ArrowRight /></Button></form>
      {error && <p role="alert" className="spotify-error">{error}</p>}
      <section className="spotify-shelf"><h2>{view === "liked" ? "Your collection" : query ? "Tracks" : "Popular now"}</h2>{loading && view === "home" ? <p className="spotify-empty">Loading music…</p> : <div className="spotify-cards">{(view === "liked" ? liked : tracks).map((item) => <Button variant="ghost" className="spotify-card" key={item.url} onClick={() => pick(item)} aria-label={`Play ${item.title}`}><div className="spotify-card-art">{art(item)}<span className="spotify-play"><Play fill="currentColor" size={22} /></span></div><strong>{item.title}</strong><span>{item.artist}</span></Button>)}</div>}{view === "liked" && !liked.length && <p className="spotify-empty">No saved music yet.</p>}</section>
    </div></main>
    <aside className="spotify-now"><div className="spotify-now-heading"><strong>Now playing</strong></div>{art(current, "spotify-now-art")}<div className="spotify-now-title"><div><h2>{current.title}</h2><p>{current.artist}</p></div><Button variant="ghost" size="icon" onClick={toggleLike} aria-label="Save music" aria-pressed={isLiked} className={isLiked ? "spotify-saved" : ""}><Heart fill={isLiked ? "currentColor" : "none"} /></Button></div><a href={current.url} target="_blank" rel="noopener noreferrer">Open original <ExternalLink size={14} /></a></aside>
    <footer className="spotify-player"><div className="spotify-player-summary">{art(current)}<div><strong>{current.title}</strong><small>{current.artist}</small></div></div><div className="spotify-embed-wrap"><iframe title="Music player" key={current.url} allow="autoplay; encrypted-media" src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(current.url)}&auto_play=false&visual=false&show_comments=false&show_user=false&show_reposts=false&buying=false&sharing=false&download=false`} /></div><Button variant="ghost" size="icon" onClick={toggleLike} aria-label="Save current music" aria-pressed={isLiked} className={isLiked ? "spotify-saved" : ""}><Heart fill={isLiked ? "currentColor" : "none"} /></Button></footer>
  </div>;
}
