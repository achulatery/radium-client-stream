import { useEffect, useState } from "react";
import { Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account";
import { getProfile, updateProfile } from "@/lib/account.functions";

export const MAX_WORDS = 20;
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function Avatar({ src, name, size = 32 }: { src?: string | null | undefined; name: string; size?: number }) {
  return src ? (
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-full font-bold" style={{ width: size, height: size, fontSize: size * 0.42, background: "var(--rd-accent-alt)", color: "var(--rd-bg)" }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** Resize to a 160px square JPEG so it stays small. */
async function toAvatar(file: File): Promise<string> {
  const img = await createImageBitmap(file);
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const s = Math.min(img.width, img.height);
  c.getContext("2d")!.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 160, 160);
  return c.toDataURL("image/jpeg", 0.85);
}

type Profile = { id: string; username: string; avatar: string | null; bio: string; createdAt: string };

export function ProfileDialog({ userId, editable, onClose }: { userId?: string | undefined; editable?: boolean | undefined; onClose: () => void }) {
  const { user, refresh } = useAccount();
  const id = userId ?? user?.id;
  const [p, setP] = useState<Profile | null>(null);
  const [edit, setEdit] = useState(false);
  const [bio, setBio] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    getProfile({ data: { id } }).then((r) => { setP(r); setBio(r.bio); setAvatar(r.avatar); }).catch(() => setMsg("Could not load profile"));
  }, [id]);

  const count = words(bio);
  const save = async () => {
    if (count > MAX_WORDS) return setMsg(`Keep it to ${MAX_WORDS} words`);
    setBusy(true); setMsg("");
    try {
      await updateProfile({ data: { bio, avatar } });
      await refresh();
      setP((x) => (x ? { ...x, bio: bio.trim(), avatar } : x));
      setEdit(false);
    } catch (e) { setMsg(e instanceof Error ? e.message : "Could not save"); } finally { setBusy(false); }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" style={{ background: "color-mix(in oklab, var(--rd-bg) 70%, transparent)" }} onClick={onClose}>
      <div role="dialog" aria-label="Profile" className="relative w-full max-w-xs overflow-hidden rounded-sm" style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-line)", color: "var(--rd-text)" }} onClick={(e) => e.stopPropagation()}>
        <div className="h-16" style={{ background: "var(--rd-accent)" }} />
        <button onClick={onClose} aria-label="Close" className="absolute right-2 top-2 rounded-full p-1" style={{ background: "var(--rd-bg)" }}><X size={14} /></button>
        {!p ? <p className="p-5 text-sm" style={{ color: "var(--rd-muted)" }}>{msg || "Loading…"}</p> : (
          <div className="px-5 pb-5">
            <div className="-mt-9 mb-3 flex items-end justify-between">
              <label className={edit ? "relative cursor-pointer" : "relative"} style={{ borderRadius: 999, border: "4px solid var(--rd-surface)" }}>
                <Avatar src={edit ? avatar : p.avatar} name={p.username} size={72} />
                {edit && <>
                  <span className="absolute inset-0 grid place-items-center rounded-full" style={{ background: "color-mix(in oklab, var(--rd-bg) 55%, transparent)" }}><Camera size={18} /></span>
                  <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; if (f) setAvatar(await toAvatar(f)); }} />
                </>}
              </label>
              {editable && !edit && <Button size="sm" variant="secondary" onClick={() => setEdit(true)}>Edit profile</Button>}
            </div>
            <h2 className="text-lg font-bold">{p.username}</h2>
            <div className="mt-3 rounded-sm p-3" style={{ background: "var(--rd-bg)" }}>
              <p className="font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>DESCRIPTION</p>
              {edit ? (
                <>
                  <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} maxLength={300} className="mt-1 w-full resize-none rounded-sm p-2 text-sm outline-none" style={{ background: "var(--rd-search)", color: "var(--rd-search-text)", border: "1px solid var(--rd-line)" }} />
                  <p className="text-right font-mono text-[10px]" style={{ color: count > MAX_WORDS ? "var(--rd-accent)" : "var(--rd-muted)" }}>{count} / {MAX_WORDS} words</p>
                </>
              ) : <p className="mt-1 text-sm">{p.bio || <span style={{ color: "var(--rd-muted)" }}>No description yet.</span>}</p>}
              <p className="mt-3 font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>MEMBER SINCE</p>
              <p className="mt-1 text-sm">{new Date(p.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}</p>
            </div>
            {edit && (
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" disabled={busy || count > MAX_WORDS} onClick={() => void save()}>Save</Button>
                {avatar && <Button size="sm" variant="ghost" onClick={() => setAvatar(null)}>Remove image</Button>}
                <Button size="sm" variant="ghost" onClick={() => { setEdit(false); setBio(p.bio); setAvatar(p.avatar); }}>Cancel</Button>
              </div>
            )}
            {msg && <p className="mt-2 text-xs" style={{ color: "var(--rd-accent)" }}>{msg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
