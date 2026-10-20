import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { attachmentLimit, CHUNK_BYTES, KLEB_BYTES, type ChatRank } from "./chat-ranks";
export const beginUpload = createServerFn({ method: "POST" })
  .validator((d: { kind: "chat" | "kleb"; roomId?: string; name: string; mime: string; size: number }) => z.object({ kind: z.enum(["chat", "kleb"]), roomId: z.string().uuid().optional(), name: z.string().min(1).max(255), mime: z.string().max(100), size: z.number().int().positive().max(15_000_000_000) }).parse(d))
  .handler(async ({ data }) => {
    const { uploadContext, cleanupAbandonedUploads } = await import("./uploads.server"); const { user, sb } = await uploadContext(data.kind, data.roomId);
    await cleanupAbandonedUploads(sb, user.id).catch(() => {});
    const { data: extra } = await sb.from("app_extras").select("chat_rank").eq("user_id", user.id).maybeSingle();
    const limit = data.kind === "kleb" ? KLEB_BYTES : attachmentLimit(user.role, (extra?.chat_rank ?? null) as ChatRank);
    if (data.size > limit) throw new Error("This file exceeds your upload allowance");
    if (data.kind === "kleb" && !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(data.mime)) throw new Error("Choose a JPEG, PNG, WebP or GIF picture");
    const id = crypto.randomUUID(); const chunks = Math.ceil(data.size / CHUNK_BYTES);
    // PostgreSQL accepts NULL for Kleb's room; generated RPC types omit argument nullability.
    const room = (data.roomId ?? null) as unknown as string;
    const { error } = await sb.rpc("reserve_radium_upload", { p_id: id, p_user: user.id, p_room: room, p_kind: data.kind, p_name: data.name, p_mime: data.mime || "application/octet-stream", p_size: data.size, p_chunks: chunks });
    if (error) throw new Error(data.kind === "kleb" ? "Kleb picture allowance reached or upload unavailable" : "Could not start upload");
    return { id, chunks };
  });
export const getUploadChunk = createServerFn({ method: "POST" })
  .validator((d: { id: string; index: number }) => z.object({ id: z.string().uuid(), index: z.number().int().min(0) }).parse(d))
  .handler(async ({ data }) => {
    const { ownedUpload } = await import("./uploads.server"); const { sb, row } = await ownedUpload(data.id);
    if (row.complete || data.index >= row.chunk_count) throw new Error("Invalid upload chunk");
    const path = `${row.user_id}/${row.id}/${data.index.toString().padStart(6, "0")}`;
    const { data: signed, error } = await sb.storage.from("radium-files").createSignedUploadUrl(path);
    if (error || !signed) throw new Error("Could not prepare upload");
    // Use the browser-facing host; server-local storage addresses are not browser reachable.
    const url = new URL(signed.signedUrl); const browser = new URL(import.meta.env['VITE_SUPABASE_URL']);
    url.protocol = browser.protocol; url.host = browser.host;
    return { url: url.toString() };
  });
export const finishUpload = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { ownedUpload, verifyChunks } = await import("./uploads.server"); const { sb, row } = await ownedUpload(data.id);
    await verifyChunks(sb, row);
    const { error } = await sb.from("app_uploads").update({ complete: true }).eq("id", row.id);
    if (error) throw new Error("Could not finish upload"); return { id: row.id, name: row.name, mime: row.mime, size: row.size_bytes };
  });
export const removeUpload = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { ownedUpload } = await import("./uploads.server"); const { sb, row } = await ownedUpload(data.id);
    if (row.message_id) throw new Error("Delete the chat message instead");
    const { removeChunks } = await import("./uploads.server"); await removeChunks(sb, row);
    await sb.from("app_uploads").delete().eq("id", row.id); return { ok: true };
  });