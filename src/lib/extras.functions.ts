import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { CHAT_RANKS } from "./chat-ranks";
const helpers = () => import("./account-session.server");
export const ownerSetExtras = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), chatRank: z.enum(CHAT_RANKS).nullable().optional(), klebEnabled: z.boolean().optional() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, db } = await helpers();
    const user = await requireUser();
    if (user.role !== "owner") throw new Error("Only the owner can grant Kleb or assign chat ranks");
    const sb = await db();
    const { data: target } = await sb.from("app_account_roles").select("role").eq("user_id", data.id).maybeSingle();
    if (target?.role === "owner" && user.id !== data.id) throw new Error("This account is protected");
    const { error } = await sb.from("app_extras").upsert({ user_id: data.id, ...(data.chatRank !== undefined ? { chat_rank: data.chatRank } : {}), ...(data.klebEnabled !== undefined ? { kleb_enabled: data.klebEnabled } : {}) });
    if (error) throw new Error("Could not save access or rank");
    return { ok: true };
  });
/** Owner-only read of a user's chat rank and Kleb grant for the Console. */
export const ownerGetExtras = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, db } = await helpers();
    const user = await requireUser();
    if (user.role !== "owner") throw new Error("Only the owner can view chat ranks");
    const sb = await db();
    const { data: row } = await sb.from("app_extras").select("chat_rank, kleb_enabled").eq("user_id", data.id).maybeSingle();
    return { chatRank: (row?.chat_rank ?? null) as (typeof CHAT_RANKS)[number] | null, klebEnabled: Boolean(row?.kleb_enabled) };
  });
export const getKleb = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser, db } = await helpers(); const user = await requireUser(); const sb = await db();
  const { data } = await sb.from("app_extras").select("*").eq("user_id", user.id).maybeSingle();
  if (user.role !== "owner" && !data?.kleb_enabled) throw new Error("Kleb access has not been granted");
  const { data: pictures } = await sb.from("app_uploads").select("id,name,size_bytes").eq("user_id", user.id).eq("kind", "kleb").eq("complete", true).order("created_at", { ascending: false });
  return { title: data?.kleb_title ?? "Kleb", body: data?.kleb_body ?? "", layout: data?.kleb_layout ?? "grid", pictures: pictures ?? [] };
});
export const saveKleb = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ title: z.string().trim().min(1).max(60), body: z.string().max(20000), layout: z.enum(["grid", "list"]) }).parse(d))
  .handler(async ({ data }) => {
    const { requireUser, db } = await helpers(); const user = await requireUser(); const sb = await db();
    const { data: access } = await sb.from("app_extras").select("kleb_enabled").eq("user_id", user.id).maybeSingle();
    if (user.role !== "owner" && !access?.kleb_enabled) throw new Error("Kleb access has been revoked");
    const { error } = await sb.from("app_extras").upsert({ user_id: user.id, kleb_title: data.title, kleb_body: data.body, kleb_layout: data.layout });
    if (error) throw new Error("Could not save Kleb"); return { ok: true };
  });