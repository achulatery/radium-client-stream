import { logActivity } from "./account.functions";

type Kind = "search" | "video" | "music" | "settings";

/** Fire-and-forget activity log for the signed-in account. */
export function track(kind: Kind, value: string, detail?: Record<string, unknown>) {
  if (!value) return;
  void logActivity({ data: { kind, value: value.slice(0, 2000), detail } }).catch(() => {});
}
