/** Formats that can safely be rendered inline by the chat attachment route. */
export const CHAT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"] as const;
export const CHAT_VIDEO_TYPES = ["video/mp4", "video/webm"] as const;
export const CHAT_MEDIA_ACCEPT = [...CHAT_IMAGE_TYPES, ...CHAT_VIDEO_TYPES, ".heic", ".heif"].join(",");
export function mediaMime(name: string, declared: string): string {
  const extension = name.split(".").pop()?.toLowerCase();
  const inferred: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif", avif: "image/avif", mp4: "video/mp4", webm: "video/webm", heic: "image/heic", heif: "image/heif" };
  return declared && declared !== "application/octet-stream" ? declared : inferred[extension ?? ""] ?? declared;
}
export function canPreviewMedia(mime: string) {
  return [...CHAT_IMAGE_TYPES, ...CHAT_VIDEO_TYPES, "audio/mpeg", "audio/ogg"].some((type) => type === mime);
}
/** Safari can decode HEIC; convert that image to a universally readable JPEG. */
export async function prepareChatMedia(file: File): Promise<File> {
  const mime = mediaMime(file.name, file.type);
  if (mime === "image/heic" || mime === "image/heif") {
    const url = URL.createObjectURL(file);
    try {
      const image = new Image(); image.src = url;
      await image.decode();
      const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Image conversion unavailable");
      context.drawImage(image, 0, 0);
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
      if (!blob) throw new Error("Image conversion unavailable");
      return new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), { type: "image/jpeg" });
    } catch { throw new Error("This browser cannot read HEIC photos. Choose a JPEG or PNG version instead."); }
    finally { URL.revokeObjectURL(url); }
  }
  if (![...CHAT_IMAGE_TYPES, ...CHAT_VIDEO_TYPES].some((type) => type === mime)) throw new Error("Choose a JPEG, PNG, WebP, GIF, AVIF, MP4 or WebM file.");
  return file.type === mime ? file : new File([file], file.name, { type: mime });
}