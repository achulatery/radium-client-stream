export type SoundCloudWidget = {
  bind: (event: string, callback: () => void) => void;
  unbind: (event: string) => void;
  seekTo: (milliseconds: number) => void;
  play: () => void;
};
type WidgetFactory = ((iframe: HTMLIFrameElement) => SoundCloudWidget) & { Events: { READY: string; FINISH: string } };
declare global { interface Window { SC?: { Widget: WidgetFactory } } }
let pending: Promise<WidgetFactory> | undefined;
export function loadSoundCloudWidget(): Promise<WidgetFactory> {
  if (window.SC?.Widget) return Promise.resolve(window.SC.Widget);
  if (pending) return pending;
  pending = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://w.soundcloud.com/player/api.js";
    script.async = true;
    script.onload = () => { if (window.SC?.Widget) resolve(window.SC.Widget); else { pending = undefined; reject(new Error("Player unavailable")); } };
    script.onerror = () => { pending = undefined; script.remove(); reject(new Error("Player unavailable")); };
    document.head.appendChild(script);
  });
  return pending;
}