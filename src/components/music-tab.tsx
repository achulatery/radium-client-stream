import { proxyUrl } from "@/lib/radium";

/** Music tab: the real SoundCloud website, loaded through Radium's proxy so it stays on Radium. */
export function MusicTab() {
  return (
    <iframe
      title="SoundCloud"
      src={proxyUrl("https://soundcloud.com/discover")}
      allow="autoplay; encrypted-media; fullscreen"
      className="h-full w-full border-0"
      style={{ background: "var(--rd-bg)" }}
    />
  );
}
