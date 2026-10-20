import { createFileRoute } from "@tanstack/react-router";
import { CHUNK_BYTES } from "@/lib/chat-ranks";
export const Route = createFileRoute("/api/public/attachment")({ server: { handlers: { GET: async ({ request }) => {
  try {
    const id = new URL(request.url).searchParams.get("id");
    if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
    const { db, requireUser } = await import("@/lib/account-session.server");
    const user = await requireUser(); const sb = await db();
    const { data: row } = await sb.from("app_uploads").select("*").eq("id", id).eq("complete", true).maybeSingle();
    if (!row) return new Response("Not found", { status: 404 });
    const { uploadContext } = await import("@/lib/uploads.server");
    if (row.kind === "kleb" || !row.message_id) { if (row.user_id !== user.id) throw new Error("Forbidden"); }
    await uploadContext(row.kind as "chat" | "kleb", row.room_id ?? undefined);
    if (row.message_id) {
      const { data: message } = await sb.from("app_chat_messages").select("deleted_at").eq("id", row.message_id).maybeSingle();
      if (!message || message.deleted_at) throw new Error("Not found");
    }
    const range = request.headers.get("range"); let start = 0; let end = row.size_bytes - 1;
    if (range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(range);
      if (!match) return new Response(null, { status: 416 });
      start = Number(match[1]); end = match[2] ? Math.min(Number(match[2]), end) : end;
      if (start > end || start >= row.size_bytes) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${row.size_bytes}` } });
    }
    let cursor = start;
    const stream = new ReadableStream<Uint8Array>({ async pull(controller) {
      if (cursor > end) { controller.close(); return; }
      const index = Math.floor(cursor / CHUNK_BYTES);
      const { data: blob, error } = await sb.storage.from("radium-files").download(`${row.user_id}/${row.id}/${index.toString().padStart(6, "0")}`);
      if (error || !blob) { controller.error(new Error("File unavailable")); return; }
      const offset = cursor % CHUNK_BYTES; const length = Math.min(blob.size - offset, end - cursor + 1);
      controller.enqueue(new Uint8Array(await blob.slice(offset, offset + length).arrayBuffer())); cursor += length;
    } });
    const preview = ["image/png", "image/jpeg", "image/webp", "image/gif", "video/mp4", "video/webm", "audio/mpeg", "audio/ogg"].includes(row.mime);
    return new Response(stream, { status: range ? 206 : 200, headers: { "Content-Type": preview ? row.mime : "application/octet-stream", "Content-Length": String(end - start + 1), "Accept-Ranges": "bytes", ...(range ? { "Content-Range": `bytes ${start}-${end}/${row.size_bytes}` } : {}), "Content-Disposition": `${preview && !new URL(request.url).searchParams.has("download") ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(row.name)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("File unavailable", { status: 403 }); }
} } } });