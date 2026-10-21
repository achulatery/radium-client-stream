import { useEffect, useRef, useState } from "react";
import { invidiousThumbnailUrl } from "@/lib/invidious";

/** Start loading a few rows ahead without fetching the entire result list. */
export function VideoThumbnail({ videoId, thumbnail, priority = false }: { videoId: string; thumbnail?: string | null; priority?: boolean }) {
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
      { rootMargin: "400px 0px" },
    );
    observer.observe(image);
    return () => observer.disconnect();
  }, [videoId, priority]);

  const fallback = failedId === videoId;
  return (
    <img
      ref={imageRef}
      src={loadedId === videoId
        ? fallback ? invidiousThumbnailUrl(videoId, "mqdefault") : thumbnail ?? invidiousThumbnailUrl(videoId)
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