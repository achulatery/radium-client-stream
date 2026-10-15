import { useEffect, useRef, useState } from "react";
import { thumbUrl } from "@/lib/piped";

/** Start loading a few rows ahead without fetching the entire result list. */
export function VideoThumbnail({ videoId, priority = false }: { videoId: string; priority?: boolean }) {
  const imageRef = useRef<HTMLImageElement>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [failedId, setFailedId] = useState<string | null>(null);

  useEffect(() => {
    const image = imageRef.current;
    if (!image) return;
    if (priority || typeof IntersectionObserver === "undefined") {
      setLoadedId(videoId);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLoadedId(videoId);
          observer.disconnect();
        }
      },
      { rootMargin: "1200px 0px" },
    );
    observer.observe(image);
    return () => observer.disconnect();
  }, [videoId, priority]);

  const fallback = failedId === videoId;
  return (
    <img
      ref={imageRef}
      src={loadedId === videoId
        ? fallback ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : thumbUrl(videoId)
        : undefined}
      referrerPolicy="no-referrer"
      onError={() => { if (!fallback) setFailedId(videoId); }}
      alt=""
      width={480}
      height={270}
      className="aspect-video w-full object-cover"
      loading="eager"
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
    />
  );
}