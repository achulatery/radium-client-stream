import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, RefreshCw, Save, Sparkles, Trash2, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/profile";
import { useAccount } from "@/lib/account";
import { getKlebPage, grantKleb, revokeKleb, saveKleb } from "@/lib/extras.functions";
import { uploadFile } from "@/lib/upload-file";
import { removeUpload } from "@/lib/uploads.functions";

type Page = Awaited<ReturnType<typeof getKlebPage>>;
const fileUrl = (id: string) => `/api/public/attachment?id=${id}`;

/** Kleb: one owner-granted personal page; staff can always view, only the holder edits. */
export function KlebTab() {
  const { user } = useAccount();
  const [page, setPage] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [grantName, setGrantName] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const picker = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const result = await getKlebPage();
      setPage(result);
      setTitle(result.title); setBody(result.body); setLayout(result.layout);
    } catch (e) { setError(e instanceof Error ? e.message : "Kleb is unavailable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setError("");
    try { await fn(); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Action failed"); }
    finally { setBusy(false); }
  };

  const addPictures = async (files: FileList | null) => {
    if (!files?.length) return;
    setError("");
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1);
      try { await uploadFile(file, "kleb", undefined, () => {}); }
      catch (e) { setError(e instanceof Error ? e.message : "Upload failed"); }
      finally { setUploading((n) => n - 1); }
    }
    await load();
  };

  if (loading) return <div className="rc-tab-loading"><RefreshCw size={18} className="animate-spin" /><span>Loading…</span></div>;

  return <div className="rd-posts">
    <header className="rd-posts-head">
      <div className="rc-title"><Sparkles size={23} /><div><h1>Kleb</h1><span>{page?.holder ? `OWNED BY ${page.holder.username.toUpperCase()}` : "NO HOLDER"}</span></div></div>
      <Button variant="ghost" size="icon" className="rc-icon" title="Refresh Kleb" aria-label="Refresh Kleb" onClick={() => void load()}><RefreshCw size={16} /></Button>
    </header>
    {error && <p role="alert" className="rc-error">{error}</p>}

    {page?.isOwner && <div className="rd-kleb-owner">
      {page.holder ? <span className="rd-kleb-holder"><Avatar src={page.holder.avatar} name={page.holder.username} size={24} /><strong>{page.holder.username}</strong> holds Kleb</span> : <span className="rc-muted">No one holds Kleb. Grant it to one person.</span>}
      <form className="rd-kleb-grant" onSubmit={(e) => { e.preventDefault(); void run(async () => { await grantKleb({ data: { username: grantName } }); setGrantName(""); }); }}>
        <input aria-label="Grant Kleb to username" placeholder="Grant to username…" value={grantName} onChange={(e) => setGrantName(e.target.value)} />
        <Button type="submit" disabled={busy || !grantName.trim()}><UserCheck size={14} />Grant</Button>
        {page.holder && <Button type="button" variant="ghost" className="rc-danger" disabled={busy} onClick={() => void run(() => revokeKleb())}><UserX size={14} />Revoke</Button>}
      </form>
    </div>}

    {!page?.holder && <div className="rc-empty"><Sparkles size={38} /><h2>Kleb</h2><p>No one has been granted Kleb yet.</p></div>}

    {page?.holder && (page.canEdit ? <div className="rd-posts-compose">
      <input aria-label="Kleb title" placeholder="Page title…" value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} />
      <textarea aria-label="Kleb body" placeholder="Write your page…" rows={6} value={body} maxLength={20000} onChange={(e) => setBody(e.target.value)} />
      <div className="rd-kleb-tools">
        <select aria-label="Picture layout" value={layout} onChange={(e) => setLayout(e.target.value === "list" ? "list" : "grid")}>
          <option value="grid">Grid pictures</option>
          <option value="list">List pictures</option>
        </select>
        <Button type="button" variant="ghost" disabled={uploading > 0} onClick={() => picker.current?.click()}><ImagePlus size={14} />{uploading > 0 ? "Uploading…" : "Add pictures"}</Button>
        <input ref={picker} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => { void addPictures(e.target.files); e.target.value = ""; }} />
        <Button type="button" disabled={busy || !title.trim()} onClick={() => void run(() => saveKleb({ data: { title: title.trim(), body, layout } }))}><Save size={14} />Save page</Button>
      </div>
    </div> : <article className="rd-post rd-kleb-page">
      <header><Avatar src={page.holder.avatar} name={page.holder.username} size={28} /><div><strong>{page.title}</strong><small>{page.holder.username}</small></div></header>
      {page.body && <p>{page.body}</p>}
    </article>)}

    {page?.holder && page.pictures.length > 0 && <div className={page.layout === "list" ? "rd-kleb-pics is-list" : "rd-kleb-pics"}>
      {page.pictures.map((pic) => <figure key={pic.id}>
        <img src={fileUrl(pic.id)} alt={pic.name} loading="lazy" decoding="async" />
        {page.canEdit && <Button variant="ghost" size="icon" className="rc-icon rc-danger" title={`Remove ${pic.name}`} aria-label={`Remove ${pic.name}`} onClick={() => void run(() => removeUpload({ data: { id: pic.id } }))}><Trash2 size={13} /></Button>}
      </figure>)}
    </div>}
  </div>;
}
