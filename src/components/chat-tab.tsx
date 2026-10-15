import { useCallback, useEffect, useRef, useState } from "react";
import { MessageSquare, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccount } from "@/lib/account";
import { listChatMessages, sendChatMessage } from "@/lib/account.functions";

type Message = Awaited<ReturnType<typeof listChatMessages>>[number];
export function ChatTab() {
  const { user } = useAccount();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try { setMessages(await listChatMessages()); setError(""); }
    catch { setError("Chat is unavailable. Try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); const timer = setInterval(() => { if (!document.hidden) void load(); }, 5000); return () => clearInterval(timer); }, [load]);
  useEffect(() => { end.current?.scrollIntoView({ block: "nearest" }); }, [messages.length]);
  return <section className="radium-chat">
    <header><div><MessageSquare size={20} /><h1>Chat</h1><span>General</span></div><Button variant="ghost" size="icon" aria-label="Refresh chat" title="Refresh chat" onClick={() => void load()}><RefreshCw size={16} /></Button></header>
    <div className="chat-messages" role="log" aria-label="Chat messages" aria-live="polite">
      {loading ? <p className="chat-empty">Loading…</p> : messages.length === 0 && <p className="chat-empty">No messages yet.</p>}
      {messages.map((message) => <article key={message.id} className={message.userId === user?.id ? "chat-message own" : "chat-message"}><div><strong>{message.username}</strong><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div><p>{message.body}</p></article>)}<div ref={end} />
    </div>
    {error && <p role="alert" className="chat-error">{error}</p>}
    <form onSubmit={async (event) => { event.preventDefault(); if (!body.trim() || busy) return; setBusy(true); try { await sendChatMessage({ data: { body } }); setBody(""); await load(); } catch { setError("Message was not sent. Try again."); } finally { setBusy(false); } }}>
      <textarea aria-label="Message" placeholder="Message General" value={body} maxLength={2000} rows={2} onChange={(event) => setBody(event.target.value)} />
      <Button variant="secondary" type="submit" disabled={busy || !body.trim()} aria-label="Send message" title="Send message"><Send size={18} /></Button>
    </form>
  </section>;
}