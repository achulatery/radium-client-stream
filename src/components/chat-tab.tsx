import { useCallback, useEffect, useRef, useState } from "react";
import { FileIcon, Hash, LogOut, Paperclip, Pencil, Plus, Send, Trash, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, ProfileDialog } from "@/components/profile";
import { RankTag, StaffTag } from "@/components/rank-tag";
import { useAccount } from "@/lib/account";
import { canModerate } from "@/lib/account-permissions";
import { formatBytes } from "@/lib/chat-ranks";
import { uploadFile } from "@/lib/upload-file";
import { removeUpload } from "@/lib/uploads.functions";
import { createRoom, deleteMessage, deleteRoom, editMessage, getMyMediaLimit, joinRoom, leaveRoom, listMessages, listRooms, sendMessage } from "@/lib/chat.functions";

type Room = Awaited<ReturnType<typeof listRooms>>[number];
type Message = Awaited<ReturnType<typeof listMessages>>[number] & { sending?: boolean };
type Pending = { key: string; file: File; preview: string | null; progress: number; uploadId?: string; error?: string; done: Promise<string | null> };
const LAST = "radium-chat-room";
const MAX_FILES = 10;
const deletedLabel = (by: string | null) =>
  by === "self" || !by ? "Message deleted" : `Message deleted by ${by === "mod" ? "moderator" : by}`;
const fileUrl = (id: string) => `/api/public/attachment?id=${id}`;

function Attachments({ items }: { items: Message["attachments"] }) {
  if (!items.length) return null;
  return <div className="dc-attachments">{items.map((a) => a.mime.startsWith("image/")
    ? <a key={a.id} href={fileUrl(a.id)} target="_blank" rel="noreferrer"><img src={fileUrl(a.id)} alt={a.name} loading="lazy" decoding="async" /></a>
    : a.mime.startsWith("video/")
      ? <video key={a.id} src={fileUrl(a.id)} controls preload="metadata" />
      : <a key={a.id} className="dc-file" href={`${fileUrl(a.id)}&download=1`}><FileIcon size={14} />{a.name}<small>{formatBytes(a.size)}</small></a>)}</div>;
}

export function ChatTab({ visible = true }: { visible?: boolean }) {
  const { user } = useAccount();
  const staff = canModerate(user?.role ?? null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"none" | "create" | "join">("none");
  const [form, setForm] = useState({ name: "", code: "", isPublic: false });
  const end = useRef<HTMLDivElement>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const requestVersion = useRef(0);
  const currentRoom = useRef(active);
  currentRoom.current = active;
  const roomCache = useRef(new Map<string, Message[]>());
  const nearBottom = useRef(true);
  const [pending, setPending] = useState<Pending[]>([]);
  const [media, setMedia] = useState<{ chatRank: Message["chatRank"]; limit: number } | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => { void getMyMediaLimit().then(setMedia).catch(() => {}); }, [user?.id]);
  // Room changes drop unsent files so they can't be posted in the wrong room.
  useEffect(() => () => {
    setPending((list) => { for (const p of list) { if (p.preview) URL.revokeObjectURL(p.preview); void p.done.then((id) => id && removeUpload({ data: { id } }).catch(() => {})); } return []; });
  }, [active]);

  const addFiles = (files: FileList | null) => {
    if (!files || !active || !media) return;
    const chosen = [...files].slice(0, MAX_FILES - pending.length);
    const total = [...pending.map((p) => p.file), ...chosen].reduce((sum, f) => sum + f.size, 0);
    if (total > media.limit) { setError(`Your media limit is ${formatBytes(media.limit)} per message`); return; }
    setError("");
    const rid = active;
    const added = chosen.map((file): Pending => {
      const key = crypto.randomUUID();
      const update = (patch: Partial<Pending>) => setPending((list) => list.map((p) => p.key === key ? { ...p, ...patch } : p));
      const done = uploadFile(file, "chat", rid, (progress) => update({ progress }))
        .then((r) => { update({ uploadId: r.id, progress: 100 }); return r.id; })
        .catch((e: unknown) => { update({ error: e instanceof Error ? e.message : "Upload failed" }); return null; });
      return { key, file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : null, progress: 0, done };
    });
    setPending((list) => [...list, ...added]);
  };
  const dropPending = (item: Pending) => {
    if (item.preview) URL.revokeObjectURL(item.preview);
    setPending((list) => list.filter((p) => p.key !== item.key));
    void item.done.then((id) => id && removeUpload({ data: { id } }).catch(() => {}));
  };

  const loadRooms = useCallback(async () => {
    const r = await listRooms();
    setRooms(r);
    setActive((cur) => {
      if (cur && r.some((x) => x.id === cur)) return cur;
      const saved = localStorage.getItem(LAST);
      return r.find((x) => x.id === saved)?.id ?? r[0]?.id ?? null;
    });
  }, []);
  const loadMessages = useCallback(async () => {
    if (!active || sendingRef.current) return;
    const version = ++requestVersion.current;
    try {
      const rows = await listMessages({ data: { roomId: active } });
      if (version !== requestVersion.current || currentRoom.current !== active) return;
      roomCache.current.set(active, rows);
      setMessages(rows); setError("");
    }
    catch (e) { if (version === requestVersion.current) setError(e instanceof Error ? e.message : "Chat is unavailable"); }
  }, [active]);

  useEffect(() => { void loadRooms().catch((e) => setError(e instanceof Error ? e.message : "Could not load rooms")); }, [loadRooms]);
  useEffect(() => {
    ++requestVersion.current;
    setMessages(active ? roomCache.current.get(active) ?? [] : []);
    setEditing(null); nearBottom.current = true;
    if (active) localStorage.setItem(LAST, active);
  }, [active]);
  useEffect(() => {
    if (!visible) return;
    void loadMessages();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (!document.hidden) await loadMessages();
      if (!cancelled) timer = setTimeout(poll, 4000);
    };
    timer = setTimeout(poll, 4000);
    return () => { cancelled = true; clearTimeout(timer); ++requestVersion.current; };
  }, [visible, loadMessages]);
  useEffect(() => { if (visible && nearBottom.current) end.current?.scrollIntoView({ block: "nearest" }); }, [messages.length, visible]);

  const submitMessage = async () => {
    const text = body.trim();
    const files = pending;
    if ((!text && !files.length) || !active || !user || sendingRef.current) return;
    if (files.some((p) => p.error)) { setError("Remove the files that failed to upload first"); return; }
    const rid = active;
    sendingRef.current = true; setSending(true); ++requestVersion.current;
    setBody(""); setError(""); nearBottom.current = true;
    const temporaryId = `pending-${crypto.randomUUID()}`;
    const optimistic: Message = { id: temporaryId, userId: user.id, username: user.username, avatar: user.avatar, authorRole: user.role, chatRank: media?.chatRank ?? null, accent: null, body: text, attachments: [], createdAt: new Date().toISOString(), editedAt: null, deleted: false, deletedBy: null, sending: true };
    const next = [...(roomCache.current.get(rid) ?? messages), optimistic];
    roomCache.current.set(rid, next); setMessages(next);
    try {
      const uploadIds = (await Promise.all(files.map((p) => p.done))).filter((id): id is string => Boolean(id));
      if (uploadIds.length !== files.length) throw new Error("A file failed to upload");
      const saved = await sendMessage({ data: { roomId: rid, body: text, uploadIds } });
      setPending((list) => { for (const p of list) if (p.preview && files.includes(p)) URL.revokeObjectURL(p.preview); return list.filter((p) => !files.includes(p)); });
      ++requestVersion.current;
      const confirmed = (roomCache.current.get(rid) ?? []).map((m) => m.id === temporaryId ? { ...m, id: saved.id, createdAt: saved.createdAt, sending: false } : m);
      roomCache.current.set(rid, confirmed);
      if (currentRoom.current === rid) setMessages(confirmed);
    } catch (e) {
      const remaining = (roomCache.current.get(rid) ?? []).filter((m) => m.id !== temporaryId);
      roomCache.current.set(rid, remaining);
      if (currentRoom.current === rid) { setMessages(remaining); setBody((draft) => draft || text); }
      setError(e instanceof Error ? e.message : "Could not send message");
    } finally { sendingRef.current = false; setSending(false); }
    if (files.length) void loadMessages();
  };

  const run = async (fn: () => Promise<unknown>) => { setError(""); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } };
  const room = rooms.find((r) => r.id === active);

  return (
    <div className="dc-shell">
      {profileId && <ProfileDialog userId={profileId} editable={profileId === user?.id} onClose={() => { setProfileId(null); void loadMessages(); }} />}
      <aside className="dc-rooms">
        <div className="dc-rooms-head">ROOMS</div>
        <ul>
          {rooms.map((r) => (
            <li key={r.id}>
              <button className={r.id === active ? "dc-room active" : "dc-room"} onClick={() => setActive(r.id)}>
                <Hash size={15} /><span>{r.name}</span>{r.isPublic ? <em>PUBLIC</em> : !r.joined && <em>VIEW</em>}
              </button>
            </li>
          ))}
        </ul>
        <div className="dc-rooms-actions">
          <Button variant="secondary" size="sm" onClick={() => setPanel(panel === "create" ? "none" : "create")}><Plus size={13} />Create</Button>
          <Button variant="secondary" size="sm" onClick={() => setPanel(panel === "join" ? "none" : "join")}><Hash size={13} />Join code</Button>
        </div>
        {panel !== "none" && (
          <form className="dc-room-form" onSubmit={(e) => { e.preventDefault(); void run(async () => {
            const r = panel === "create" ? await createRoom({ data: form }) : await joinRoom({ data: { code: form.code } });
            setForm({ name: "", code: "", isPublic: false }); setPanel("none"); await loadRooms(); setActive(r.id);
          }); }}>
            {panel === "create" && <input placeholder="Room name" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
            {panel === "create" && staff && <label className="flex items-center justify-between gap-2 text-xs">Public chat<Switch aria-label="Public chat" checked={form.isPublic} onCheckedChange={(isPublic) => setForm({ ...form, isPublic })} /></label>}
            <input placeholder={panel === "create" ? "Custom room code" : "Enter room code"} value={form.code} maxLength={24} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Button type="submit" size="sm">{panel === "create" ? "Create room" : "Join room"}</Button>
          </form>
        )}
        <button type="button" className="dc-user" onClick={() => user && setProfileId(user.id)} title="Your profile"><Avatar src={user?.avatar} name={user?.username ?? "?"} size={32} /><span>{user?.username}</span><StaffTag role={user?.role} />{user?.role === "mod" && <b>MOD</b>}<RankTag rank={media?.chatRank ?? null} /></button>
      </aside>

      <section className="dc-main">
        <header className="dc-head">
          <div><Hash size={18} /><strong>{room?.name ?? "…"}</strong>{room && <span>code: {room.code}</span>}</div>
          <div className="flex gap-1">
            {room && room.code !== "general" && room.joined && <Button variant="ghost" size="icon" title="Leave room" aria-label="Leave room" onClick={() => void run(async () => { await leaveRoom({ data: { roomId: room.id } }); setActive(null); await loadRooms(); })}><LogOut size={15} /></Button>}
            {room && room.code !== "general" && staff && <Button variant="ghost" size="icon" title="Delete room" aria-label="Delete room" onClick={() => window.confirm(`Delete #${room.name}?`) && void run(async () => { await deleteRoom({ data: { roomId: room.id } }); setActive(null); await loadRooms(); })}><Trash2 size={15} /></Button>}
          </div>
        </header>

        <div className="dc-messages" role="log" aria-live="polite" onScroll={(e) => { const el = e.currentTarget; nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
          {messages.length === 0 && <p className="chat-empty">No messages yet. Say hi!</p>}
          {messages.map((m, i) => {
            const prev = i > 0 ? messages[i - 1] : undefined;
            const grouped = !!prev && prev.userId === m.userId && !prev.deleted && !m.deleted && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < 300000;
            const own = m.userId === user?.id;
            return (
              <article key={m.id} className={grouped ? "dc-msg grouped" : "dc-msg"}>
                {!grouped && <button type="button" className="dc-avatar-btn" onClick={() => setProfileId(m.userId)} aria-label={`View ${m.username}'s profile`}><Avatar src={m.avatar} name={m.username} size={40} /></button>}
                <div className="dc-msg-body">
                  {!grouped && <div className="dc-msg-meta"><strong role="button" tabIndex={0} className="cursor-pointer hover:underline" onClick={() => setProfileId(m.userId)}>{m.username}</strong><StaffTag role={m.authorRole} />{m.authorRole === "mod" && <b>MOD</b>}<RankTag rank={m.chatRank} accent={m.accent} /><time>{new Date(m.createdAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}</time></div>}
                  {editing?.id === m.id ? (
                    <form className="dc-edit" onSubmit={(e) => { e.preventDefault(); void run(async () => { await editMessage({ data: editing }); setEditing(null); await loadMessages(); }); }}>
                      <input autoFocus value={editing.body} maxLength={2000} onChange={(e) => setEditing({ ...editing, body: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setEditing(null)} />
                      <Button type="submit" size="sm">Save</Button><Button type="button" variant="ghost" size="icon" onClick={() => setEditing(null)}><X size={14} /></Button>
                    </form>
                  ) : m.deleted ? (
                    <><p className="dc-deleted">{deletedLabel(m.deletedBy)}{staff && m.body && <span className="dc-mod-view"> — {m.body}</span>}</p>{staff && <Attachments items={m.attachments} />}</>
                  ) : (
                    <>{(m.body || m.editedAt) && <p>{m.body}{m.editedAt && <small> (edited)</small>}</p>}<Attachments items={m.attachments} /></>
                  )}
                </div>
                {!m.deleted && !m.sending && editing?.id !== m.id && (own || staff) && (
                  <div className="dc-tools">
                    {own && <button title="Edit" aria-label="Edit message" onClick={() => setEditing({ id: m.id, body: m.body })}><Pencil size={14} /></button>}
                    <button title="Delete" aria-label="Delete message" onClick={() => void run(async () => { await deleteMessage({ data: { id: m.id } }); await loadMessages(); })}><Trash2 size={14} /></button>
                    {user?.role === "owner" && <button title="Delete forever — no one will see it was deleted" aria-label="Delete message forever" onClick={() => { if (window.confirm("Completely delete this message? No one will see that it was deleted.")) void run(async () => { await deleteMessage({ data: { id: m.id, hard: true } }); await loadMessages(); }); }}><Trash size={14} /></button>}
                  </div>
                )}
              </article>
            );
          })}
          <div ref={end} />
        </div>
        {error && <p role="alert" className="chat-error">{error}</p>}
        <form className={`dc-compose ${body ? "is-typing" : ""}`} onSubmit={(e) => { e.preventDefault(); void submitMessage(); }}>
          <input aria-label="Message" placeholder={`Message #${room?.name ?? ""}`} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
          <Button variant="ghost" size="icon" type="submit" disabled={!body.trim() || sending || !active} aria-label="Send"><Send size={17} /></Button>
        </form>
      </section>
    </div>
  );
}
