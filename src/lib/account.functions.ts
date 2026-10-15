/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { useSession } from "@tanstack/react-start/server";
import { z } from "zod";
import { canChangePassword, canModerate, canPromote, type AccountRole } from "./account-permissions";

type AccountSession = { userId?: string };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"] ?? "",
    name: "radium-account",
    // No maxAge: session cookie, cleared when the browser closes.
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function currentUser() {
  const session = await useSession<AccountSession>(sessionConfig());
  const id = session.data.userId;
  if (!id) return null;
  const sb = await db();
  const { data } = await sb.from("app_users").select("*").eq("id", id).maybeSingle();
  if (!data) return null;
  const { data: roleRow } = await sb.from("app_account_roles").select("role").eq("user_id", id).maybeSingle();
  const role: AccountRole = roleRow?.role === "owner" || roleRow?.role === "mod" ? roleRow.role : null;
  return { ...data, role };
}

async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  if (user.banned) throw new Error("This account has been banned");
  return user;
}

async function requireAdmin() {
  const user = await requireUser();
  if (!canModerate(user.role)) throw new Error("Forbidden");
  return user;
}

const creds = z.object({
  username: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(200),
});

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const user = await currentUser();
  if (!user) return { user: null, banned: false };
  if (user.banned) return { user: null, banned: true };
  const sb = await db();
  await sb.from("app_users").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
  return {
    banned: false,
    user: {
      id: user.id,
      username: user.username,
      isAdmin: canModerate(user.role),
      role: user.role,
      settings: (user.settings ?? {}) as Record<string, any>,
    },
  };
});

export const signUp = createServerFn({ method: "POST" })
  .inputValidator((d) => creds.parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: existing } = await sb
      .from("app_users")
      .select("id")
      .ilike("username", data.username.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
    if (existing) return { ok: false as const, error: "That username is taken" };
    const { data: row, error } = await sb
      .from("app_users")
      .insert({ username: data.username, password: await (await import("./password.server")).hashPassword(data.password) })
      .select("id")
      .single();
    if (error || !row) return { ok: false as const, error: "Could not create account" };
    const session = await useSession<AccountSession>(sessionConfig());
    await session.update({ userId: row.id });
    return { ok: true as const };
  });

export const signIn = createServerFn({ method: "POST" })
  .inputValidator((d) => creds.parse(d))
  .handler(async ({ data }) => {
    const sb = await db();
    const { data: row } = await sb
      .from("app_users")
      .select("id, password, banned")
      .ilike("username", data.username.replace(/[%_\\]/g, "\\$&"))
      .maybeSingle();
    if (!row || !await (await import("./password.server")).verifyPassword(data.password, row.password))
      return { ok: false as const, error: "Wrong username or password" };
    if (row.banned) return { ok: false as const, error: "This account has been banned" };
    const session = await useSession<AccountSession>(sessionConfig());
    await session.update({ userId: row.id });
    return { ok: true as const };
  });

export const signOut = createServerFn({ method: "POST" }).handler(async () => {
  const session = await useSession<AccountSession>(sessionConfig());
  await session.clear();
  return { ok: true };
});

const kinds = z.enum(["search", "video", "music", "settings"]);

export const logActivity = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        kind: kinds,
        value: z.string().max(2000),
        detail: z.record(z.unknown()).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = await db();
    await sb.from("app_activity").insert({
      user_id: user.id,
      kind: data.kind,
      value: data.value,
      detail: (data.detail ?? {}) as never,
    });
    return { ok: true };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .inputValidator((d) => z.record(z.unknown()).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = await db();
    await sb.from("app_users").update({ settings: data as never }).eq("id", user.id);
    return { ok: true };
  });

/** "Deleting" history only hides it from the user; the admin still sees it. */
export const clearMyHistory = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ kind: kinds }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = await db();
    await sb.from("app_activity").update({ hidden: true }).eq("user_id", user.id).eq("kind", data.kind);
    return { ok: true };
  });

export const adminListUsers = createServerFn({ method: "GET" }).handler(async () => {
  await requireAdmin();
  const sb = await db();
  const { data } = await sb
    .from("app_users")
    .select("id, username, is_admin, banned, created_at, last_seen")
    .order("created_at", { ascending: false });
  const { data: roles } = await sb.from("app_account_roles").select("user_id, role");
  return (data ?? []).map((row) => {
    const role = roles?.find((entry) => entry.user_id === row.id)?.role ?? null;
    return { ...row, is_admin: role !== null, role };
  });
});

export const adminGetUser = createServerFn({ method: "GET" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    await requireAdmin();
    const sb = await db();
    const { data: user } = await sb.from("app_users").select("*").eq("id", data.id).maybeSingle();
    if (!user) throw new Error("User not found");
    const { data: activity } = await sb
      .from("app_activity")
      .select("id, kind, value, detail, hidden, created_at")
      .eq("user_id", data.id)
      .order("created_at", { ascending: false })
      .limit(1000);
    return {
      user: {
        id: user.id,
        username: user.username,
        password: null,
        isAdmin: Boolean((await sb.from("app_account_roles").select("role").eq("user_id", user.id).maybeSingle()).data),
        banned: user.banned,
        settings: user.settings as Record<string, any>,
        createdAt: user.created_at,
        lastSeen: user.last_seen,
      },
      activity: (activity ?? []).map((a) => ({ ...a, detail: a.detail as Record<string, any> })),
    };
  });

export const adminSetBan = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), banned: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (admin.id === data.id) throw new Error("You can't ban yourself");
    const sb = await db();
    const { data: target } = await sb.from("app_account_roles").select("role").eq("user_id", data.id).maybeSingle();
    if (target?.role === "owner") throw new Error("This account is protected");
    await sb.from("app_users").update({ banned: data.banned }).eq("id", data.id);
    return { ok: true };
  });

const PROTECTED_ADMIN = "achulate";

/** Only the protected owner role can promote moderators. */
function requireOwner(user: { role: AccountRole }) {
  if (!canPromote(user.role))
    throw new Error("Only the owner account can do that");
}

export const adminSetMod = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), isMod: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    requireOwner(admin);
    if (admin.id === data.id) throw new Error("You can't change your own role");
    const sb = await db();
    const { data: target } = await sb.from("app_users").select("username").eq("id", data.id).maybeSingle();
    if (!target) throw new Error("User not found");
    if (target.username.toLowerCase() === PROTECTED_ADMIN) throw new Error("This account is protected");
    const result = data.isMod
      ? await sb.from("app_account_roles").upsert({ user_id: data.id, role: "mod" })
      : await sb.from("app_account_roles").delete().eq("user_id", data.id);
    if (result.error) throw new Error("Could not update mod permissions");
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const admin = await requireAdmin();
    if (admin.id === data.id) throw new Error("You can't delete yourself");
    const sb = await db();
    const { data: target } = await sb.from("app_users").select("username").eq("id", data.id).maybeSingle();
    if (!target) throw new Error("User not found");
    if (target.username.toLowerCase() === PROTECTED_ADMIN) throw new Error("This account is protected");
    await sb.from("app_activity").delete().eq("user_id", data.id);
    await sb.from("app_users").delete().eq("id", data.id);
    return { ok: true };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const { verifyPassword, hashPassword } = await import("./password.server");
    if (!await verifyPassword(data.currentPassword, user.password)) throw new Error("Current password is incorrect");
    const sb = await db();
    const { error } = await sb.from("app_users").update({ password: await hashPassword(data.newPassword) }).eq("id", user.id);
    if (error) throw new Error("Could not change password");
    return { ok: true };
  });

export const ownerChangePassword = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ id: z.string().uuid(), newPassword: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    if (!canChangePassword(user.role, user.id, data.id) || user.role !== "owner") throw new Error("Only Achulate can change another user's password");
    const sb = await db();
    const { error, data: target } = await sb.from("app_users").update({ password: await (await import("./password.server")).hashPassword(data.newPassword) }).eq("id", data.id).select("id").maybeSingle();
    if (error || !target) throw new Error("Could not change password");
    return { ok: true };
  });

export const listChatMessages = createServerFn({ method: "GET" }).handler(async () => {
  await requireUser();
  const sb = await db();
  const { data, error } = await sb.from("app_chat_messages").select("id, user_id, body, created_at, app_users(username)").order("created_at", { ascending: false }).limit(100);
  if (error) throw new Error("Could not load chat");
  return (data ?? []).reverse().map((row) => ({ id: row.id, userId: row.user_id, body: row.body, createdAt: row.created_at, username: row.app_users?.username ?? "Deleted user" }));
});
export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ body: z.string().trim().min(1).max(2000) }).parse(d))
  .handler(async ({ data }) => {
    const user = await requireUser();
    const sb = await db();
    const { error } = await sb.from("app_chat_messages").insert({ user_id: user.id, body: data.body });
    if (error) throw new Error("Could not send message");
    return { ok: true };
  });
