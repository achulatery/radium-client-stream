import { useSession } from "@tanstack/react-start/server";
import { canModerate, type AccountRole } from "./account-permissions";
type AccountSession = { userId?: string };

function sessionConfig() {
  return {
    password: process.env["SESSION_SECRET"] ?? "",
    name: "radium-account",
    // No maxAge: session cookie, cleared when the browser closes.
    cookie: { httpOnly: true, secure: true, sameSite: "none" as const, path: "/" },
  };
}

export async function db() {
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
  const role: AccountRole = roleRow?.role === "owner" || roleRow?.role === "admin" || roleRow?.role === "mod" ? roleRow.role : null;
  return { ...data, role };
}

export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new Error("Not signed in");
  if (user.banned) throw new Error("This account has been banned");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (!canModerate(user.role)) throw new Error("Forbidden");
  return user;
}

