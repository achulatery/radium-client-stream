import { useCallback, useEffect, useRef, useState } from "react";
import { Hash, LogOut, Pencil, Plus, Send, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account";
import { canModerate } from "@/lib/account-permissions";
import { createRoom, deleteMessage, deleteRoom, editMessage, joinRoom, leaveRoom, listMessages, listRooms, sendMessage } from "@/lib/chat.functions";

type Room = Awaited<ReturnType<typeof listRooms>>[number];
type Message = Awaited<ReturnType<typeof listMessages>>[number];
const LAST = "radium-chat-room";
const roleLabel: Record<string, string> = { owner: "OWNER", admin: "ADMIN", mod: "MOD" };
const deletedLabel = (by: string | null) =>
  by === "self" || !by ? "Message deleted" : `Message deleted by ${by === "mod" ? "moderator" : by}`;

export function ChatTab() {
  const { user } = useAccount();
  const staff = canModerate(user?.role ?? null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [error, setError] = useState("");
  const [panel, setPanel] = useState<"none" | "create" | "join">("none");
  const [form, setForm] = useState({ name: "", code: "" });
  const end = useRef<HTMLDivElement>(null);

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
    if (!active) return;
    try { setMessages(await listMessages({ data: { roomId: active } })); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Chat is unavailable"); }
  }, [active]);

  useEffect(() => { void loadRooms(); }, [loadRooms]);
  useEffect(() => { if (active) localStorage.setItem(LAST, active); void loadMessages(); const t = setInterval(() => { if (!document.hidden) void loadMessages(); }, 4000); return () => clearInterval(t); }, [active, loadMessages]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);

  const run = async (fn: () => Promise<unknown>) => { setError(""); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong"); } };
  const room = rooms.find((r) => r.id === active);

  return (
    <div className="dc-shell">
      <aside className="dc-rooms">
        <div className="dc-rooms-head">ROOMS</div>
        <ul>
          {rooms.map((r) => (
            <li key={r.id}>
              <button className={r.id === active ? "dc-room active" : "dc-room"} onClick={() => setActive(r.id)}>
                <Hash size={15} /><span>{r.name}</span>{!r.joined && <em>VIEW</em>}
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
            setForm({ name: "", code: "" }); setPanel("none"); await loadRooms(); setActive(r.id);
          }); }}>
            {panel === "create" && <input placeholder="Room name" value={form.name} maxLength={60} onChange={(e) => setForm({ ...form, name: e.target.value })} required />}
            <input placeholder={panel === "create" ? "Custom room code" : "Enter room code"} value={form.code} maxLength={24} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            <Button type="submit" size="sm">{panel === "create" ? "Create room" : "Join room"}</Button>
          </form>
        )}
        <div className="dc-user"><span className="dc-avatar">{user?.username.slice(0, 1).toUpperCase()}</span><span>{user?.username}</span>{user?.role && <b>{roleLabel[user.role]}</b>}</div>
      </aside>

      <section className="dc-main">
        <header className="dc-head">
          <div><Hash size={18} /><strong>{room?.name ?? "…"}</strong>{room && <span>code: {room.code}</span>}</div>
          <div className="flex gap-1">
            {room && room.code !== "general" && room.joined && <Button variant="ghost" size="icon" title="Leave room" aria-label="Leave room" onClick={() => void run(async () => { await leaveRoom({ data: { roomId: room.id } }); setActive(null); await loadRooms(); })}><LogOut size={15} /></Button>}
            {room && room.code !== "general" && staff && <Button variant="ghost" size="icon" title="Delete room" aria-label="Delete room" onClick={() => window.confirm(`Delete #${room.name}?`) && void run(async () => { await deleteRoom({ data: { roomId: room.id } }); setActive(null); await loadRooms(); })}><Trash2 size={15} /></Button>}
          </div>
        </header>

        <div className="dc-messages" role="log" aria-live="polite">
          {messages.length === 0 && <p className="chat-empty">No messages yet. Say hi!</p>}
          {messages.map((m, i) => {
            const grouped = i > 0 && messages[i - 1].userId === m.userId && !messages[i - 1].deleted && !m.deleted && new Date(m.createdAt).getTime() - new Date(messages[i - 1].createdAt).getTime() < 300000;
            const own = m.userId === user?.id;
            return (
              <article key={m.id} className={grouped ? "dc-msg grouped" : "dc-msg"}>
                {!grouped && <span className="dc-avatar">{m.username.slice(0, 1).toUpperCase()}</span>}
                <div className="dc-msg-body">
                  {!grouped && <div className="dc-msg-meta"><strong>{m.username}</strong>{m.authorRole && <b>{roleLabel[m.authorRole]}</b>}<time>{new Date(m.createdAt).toLocaleString([], { hour: "2-digit", minute: "2-digit", month: "short", day: "numeric" })}</time></div>}
                  {editing?.id === m.id ? (
                    <form className="dc-edit" onSubmit={(e) => { e.preventDefault(); void run(async () => { await editMessage({ data: editing }); setEditing(null); await loadMessages(); }); }}>
                      <input autoFocus value={editing.body} maxLength={2000} onChange={(e) => setEditing({ ...editing, body: e.target.value })} onKeyDown={(e) => e.key === "Escape" && setEditing(null)} />
                      <Button type="submit" size="sm">Save</Button><Button type="button" variant="ghost" size="icon" onClick={() => setEditing(null)}><X size={14} /></Button>
                    </form>
                  ) : m.deleted ? (
                    <p className="dc-deleted">{deletedLabel(m.deletedBy)}{staff && m.body && <span className="dc-mod-view"> — {m.body}</span>}</p>
                  ) : (
                    <p>{m.body}{m.editedAt && <small> (edited)</small>}</p>
                  )}
                </div>
                {!m.deleted && editing?.id !== m.id && (own || staff) && (
                  <div className="dc-tools">
                    {own && <button title="Edit" aria-label="Edit message" onClick={() => setEditing({ id: m.id, body: m.body })}><Pencil size={14} /></button>}
                    <button title="Delete" aria-label="Delete message" onClick={() => void run(async () => { await deleteMessage({ data: { id: m.id } }); await loadMessages(); })}><Trash2 size={14} /></button>
                  </div>
                )}
              </article>
            );
          })}
          <div ref={end} />
        </div>
        {error && <p role="alert" className="chat-error">{error}</p>}
        <form className="dc-compose" onSubmit={(e) => { e.preventDefault(); if (!body.trim() || !active) return; void run(async () => { await sendMessage({ data: { roomId: active, body } }); setBody(""); await loadMessages(); }); }}>
          <input aria-label="Message" placeholder={`Message #${room?.name ?? ""}`} value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
          <Button variant="ghost" size="icon" type="submit" disabled={!body.trim()} aria-label="Send"><Send size={17} /></Button>
        </form>
      </section>
    </div>
  );
}
