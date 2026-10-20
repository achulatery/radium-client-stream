import { beginUpload, finishUpload, getUploadChunk, removeUpload } from "./uploads.functions";
import { CHUNK_BYTES } from "./chat-ranks";
export async function uploadFile(file: File, kind: "chat" | "kleb", roomId: string | undefined, progress: (percent: number) => void, signal?: AbortSignal) {
  const { id, chunks } = await beginUpload({ data: { kind, ...(roomId ? { roomId } : {}), name: file.name, mime: file.type, size: file.size } });
  try {
    for (let i = 0; i < chunks; i++) {
      signal?.throwIfAborted();
      const { url } = await getUploadChunk({ data: { id, index: i } });
      const response = await fetch(url, { method: "PUT", headers: { "Content-Type": "application/octet-stream", "x-upsert": "false" }, body: file.slice(i * CHUNK_BYTES, Math.min(file.size, (i + 1) * CHUNK_BYTES)), signal: signal ?? null });
      if (!response.ok) throw new Error("Upload failed; please try again");
      progress(Math.round((i + 1) / chunks * 100));
    }
    return await finishUpload({ data: { id } });
  } catch (error) { await removeUpload({ data: { id } }).catch(() => {}); throw error; }
}