import { useCallback, useEffect, useState } from "react";
import { Megaphone, Newspaper, RefreshCw, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/profile";
import { useAccount } from "@/lib/account";
import { canModerate } from "@/lib/account-permissions";
import { createPost, deletePost, listPosts } from "@/lib/posts.functions";

type Post = Awaited<ReturnType<typeof listPosts>>[number];
const fmt = (d: string) => new Date(d).toLocaleString("en-SG", { timeZone: "Asia/Singapore", dateStyle: "medium", timeStyle: "short" });

/** Announcements and Updates: everyone reads, mods and above publish. */
export function PostsTab({ kind }: { kind: "announcement" | "update" }) {
  const { user } = useAccount();
  const staff = canModerate(user?.role ?? null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const label = kind === "announcement" ? "Announcements" : "Updates";
  const Icon = kind === "announcement" ? Megaphone : Newspaper;

  const load = useCallback(async () => {
    try { setPosts(await listPosts({ data: { kind } })); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load posts"); }
    finally { setLoading(false); }
  }, [kind]);
  useEffect(() => { setLoading(true); void load(); }, [load]);

  const publish = async () => {
    if (busy || !title.trim()) return;
    setBusy(true); setError("");
    try {
      await createPost({ data: { kind, title: title.trim(), body: body.trim() } });
      setTitle(""); setBody("");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not publish"); }
    finally { setBusy(false); }
  };

  return <div className="rd-posts">
    <header className="rd-posts-head">
      <div className="rc-title"><Icon size={23} /><div><h1>{label}</h1><span>{kind === "announcement" ? "STAFF BULLETINS" : "WHAT'S NEW"}</span></div></div>
      <Button variant="ghost" size="icon" className="rc-icon" disabled={loading} title={`Refresh ${label.toLowerCase()}`} aria-label={`Refresh ${label.toLowerCase()}`} onClick={() => void load()}><RefreshCw size={16} className={loading ? "animate-spin" : undefined} /></Button>
    </header>
    {error && <p role="alert" className="rc-error">{error}</p>}
    {staff && <form className="rd-posts-compose" onSubmit={(e) => { e.preventDefault(); void publish(); }}>
      <input aria-label={`${label} title`} placeholder={`${kind === "announcement" ? "Announcement" : "Update"} title…`} value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
      <textarea aria-label={`${label} body`} placeholder="Write the details…" rows={3} value={body} maxLength={5000} onChange={(e) => setBody(e.target.value)} />
      <Button type="submit" disabled={busy || !title.trim()}><Send size={14} />Publish</Button>
    </form>}
    <div className="rd-posts-list">
      {loading && !posts.length && <p className="rc-muted">Loading…</p>}
      {!loading && !posts.length && <div className="rc-empty"><Icon size={38} /><h2>{label}</h2><p>Nothing posted yet.</p></div>}
      {posts.map((post) => <article key={post.id} className="rd-post">
        <header>
          <Avatar src={post.avatar} name={post.author} size={28} />
          <div><strong>{post.title}</strong><small>{post.author} · {fmt(post.createdAt)}</small></div>
          {staff && <Button variant="ghost" size="icon" className="rc-icon rc-danger" title="Delete post" aria-label={`Delete ${post.title}`} onClick={() => void deletePost({ data: { id: post.id } }).then(load).catch(() => setError("Could not delete the post"))}><Trash2 size={14} /></Button>}
        </header>
        {post.body && <p>{post.body}</p>}
      </article>)}
    </div>
  </div>;
}
