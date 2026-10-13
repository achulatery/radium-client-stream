/**
 * Music tab: SoundCloud's own player, loaded directly from SoundCloud (no proxy).
 * The full soundcloud.com site refuses to be shown inside other sites, so the
 * official SoundCloud player is used instead. It stays mounted so music keeps
 * playing while switching tabs or leaving the page.
 */
const PLAYER =
  "https://w.soundcloud.com/player/?url=" +
  encodeURIComponent("https://soundcloud.com/soundcloud") +
  "&visual=true&auto_play=false&show_comments=true&show_user=true&hide_related=false";

export function MusicTab() {
  return (
    <iframe
      title="SoundCloud"
      src={PLAYER}
      allow="autoplay; encrypted-media; fullscreen"
      className="h-full w-full border-0"
      style={{ background: "var(--rd-bg)" }}
    />
  );
}
