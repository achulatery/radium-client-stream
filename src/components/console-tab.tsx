import { useCallback, useEffect, useRef, useState } from "react";
import { Activity, Ban, ChevronDown, Globe, KeyRound, MessageSquare, Music, RefreshCw, Search, ShieldCheck, ShieldPlus, SlidersHorizontal, Sparkles, Trash2, Users, Youtube } from "lucide-react";
import { adminDeleteUser, adminGetUser, adminListUsers, adminSetMod, adminSetBan, adminSetBlockedTabs } from "@/lib/account.functions";
import { useAccount } from "@/lib/account";
import { canDeleteAccounts, canRevokeTabs, roleRank } from "@/lib/account-permissions";
import { attachmentLimit, CHAT_RANKS, formatBytes, type ChatRank } from "@/lib/chat-ranks";
import { ownerGetExtras, ownerSetExtras } from "@/lib/extras.functions";
import { Button } from "@/components/ui/button";
import { Avatar, ProfileDialog } from "@/components/profile";
import { RankTag } from "@/components/rank-tag";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { PasswordSettings } from "./password-settings";

type UserRow = Awaited<ReturnType<typeof adminListUsers>>[number];
type Detail = Awaited<ReturnType<typeof adminGetUser>>;
type Filter = "search" | "video" | "music" | "settings";
const fmt = (d: string) => new Date(d).toLocaleString("en-SG", { timeZone: "Asia/Singapore", dateStyle: "medium", timeStyle: "short" });
const filters = [["search", "Browser"], ["video", "YouTube"], ["music", "Music"], ["settings", "Settings"]] as const;
const accessItems = [["browser", "Browser", Globe], ["youtube", "YouTube", Youtube], ["chat", "Chat", MessageSquare], ["music", "Music", Music]] as const;

export function ConsoleTab({ visible = true }: { visible?: boolean }) {
  const { user: me } = useAccount();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState<Filter>("search");
  const [query, setQuery] = useState("");
  const [historyQuery, setHistoryQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [err, setErr] = useState("");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [extras, setExtras] = useState<{ chatRank: ChatRank; klebEnabled: boolean } | null>(null);
  const [now, setNow] = useState(0);
  const online = (lastSeen: string) => now > 0 && now - Date.parse(lastSeen) < 90000;
  const detailRequest = useRef(0);
  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    try { setUsers(await adminListUsers()); }
    finally { setLoadingUsers(false); }
  }, []);
  const loadDetail = useCallback(async (id: string) => {
    const request = ++detailRequest.current;
    setLoadingDetail(true);
    try { const result = await adminGetUser({ data: { id } }); if (request === detailRequest.current) setDetail(result); }
    finally { if (request === detailRequest.current) setLoadingDetail(false); }
  }, []);
  useEffect(() => { void loadUsers().catch((e) => setErr(e instanceof Error ? e.message : "Could not load users")); }, [loadUsers]);
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let running = false;
    const poll = async () => {
      if (document.hidden || running) return;
      running = true;
      setNow(Date.now());
      try { const rows = await adminListUsers(); if (!cancelled) setUsers(rows); }
      catch { /* Keep the last successful roster. */ }
      finally { running = false; }
    };
    void poll();
    const timer = setInterval(() => void poll(), 30000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [visible]);
  useEffect(() => {
    setDetail(null); setHistoryQuery(""); setErr(""); setExtras(null);
    if (selected) void loadDetail(selected).catch((e) => setErr(e instanceof Error ? e.message : "Could not load account"));
    let cancelled = false;
    if (selected && me?.role === "owner") void ownerGetExtras({ data: { id: selected } }).then((x) => { if (!cancelled) setExtras(x); }).catch(() => {});
    return () => { ++detailRequest.current; cancelled = true; };
  }, [selected, loadDetail, me?.role]);
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true); setErr("");
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : "Action failed"); } finally { setBusy(false); }
  };
  const refreshSelected = async (id: string) => { await Promise.all([loadUsers(), loadDetail(id)]); };
  const own = detail?.user.id === me?.id;
  const protectedAccount = detail?.user.username.toLowerCase() === "achulate";
  const outranks = roleRank(me?.role ?? null) > roleRank(detail?.user.role ?? null);
   const canAct = !!detail && !own && !protectedAccount && outranks;
  const visibleUsers = users.filter((u) => u.username.toLowerCase().includes(query.toLowerCase()));
  const items = detail?.activity.filter((a) => a.kind === filter && a.value.toLowerCase().includes(historyQuery.toLowerCase())) ?? [];

  return <div className="rc-shell">
    {profileId && <ProfileDialog userId={profileId} editable={profileId === me?.id} onClose={() => { setProfileId(null); void loadUsers(); }} />}
    <header className="rc-heading">
      <div className="rc-title"><ShieldCheck size={23} /><div><h1>Console</h1><span>ACCOUNT CONTROL</span></div></div>
      <div className="rc-counts"><span><Users size={14} /><b>{users.length}</b> accounts</span><span><ShieldCheck size={14} /><b>{users.filter((u) => u.role).length}</b> staff</span></div>
      <Button variant="ghost" size="icon" className="rc-icon" disabled={loadingUsers || busy} title="Refresh accounts" aria-label="Refresh users" onClick={() => void run(loadUsers)}><RefreshCw size={16} className={loadingUsers ? "animate-spin" : undefined} /></Button>
    </header>
    {err && <p role="alert" className="rc-error">{err}</p>}
    <div className="rc-workspace">
      <aside className="rc-roster">
        <label className="rc-search"><Search size={15} /><input aria-label="Search accounts" placeholder="Find an account…" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
        <div className="rc-list-label">ACCOUNTS <span>{visibleUsers.length}</span></div>
        <ul className="rc-user-list">
          {loadingUsers && !users.length && [0, 1, 2, 3].map((n) => <li key={n} className="rc-skeleton animate-pulse" />)}
          {visibleUsers.map((u) => <li key={u.id}><Button variant="ghost" className={`rc-user ${selected === u.id ? "is-selected" : ""}`} onClick={() => setSelected(u.id)}>
            <span className="rc-profile-image"><Avatar src={u.avatar} name={u.username} size={32} /><span aria-label={online(u.last_seen) ? "Online" : "Offline"} title={online(u.last_seen) ? "Online" : "Offline"} className={`rc-presence ${online(u.last_seen) ? "is-online" : "is-offline"}`} /></span><span><strong>{u.username}</strong><small>{u.banned ? "Banned" : u.role ? u.role.toUpperCase() : "Member"}</small></span>
          </Button></li>)}
          {!loadingUsers && !visibleUsers.length && <li className="rc-muted rc-no-results">No accounts found.</li>}
        </ul>
        <div className="rc-roster-foot"><ShieldCheck size={13} />{me?.role?.toUpperCase()} SESSION</div>
      </aside>
      <section className="rc-detail" aria-busy={loadingDetail}>
        {!selected && <div className="rc-empty"><Users size={38} /><h2>Accounts</h2><p>Select an account</p></div>}
        {selected && !detail && <div className="rc-empty"><RefreshCw size={26} className={loadingDetail ? "animate-spin" : undefined} /><p>{loadingDetail ? "Loading account…" : "Account unavailable"}</p></div>}
        {detail && <>
          <div className="rc-account-head"><Button variant="ghost" size="icon" className="rc-profile-button" aria-label={`View ${detail.user.username}'s profile`} onClick={() => setProfileId(detail.user.id)}><Avatar src={detail.user.avatar} name={detail.user.username} size={48} /></Button><div className="rc-account-name"><Button variant="ghost" className="rc-profile-name" onClick={() => setProfileId(detail.user.id)}><h2>{detail.user.username}</h2></Button><span className="rc-role">{(detail.user.role ?? "member").toUpperCase()}</span></div><span className="rc-status"><span className={`rc-presence ${online(users.find((u) => u.id === detail.user.id)?.last_seen ?? detail.user.lastSeen) ? "is-online" : "is-offline"}`} />{online(users.find((u) => u.id === detail.user.id)?.last_seen ?? detail.user.lastSeen) ? "Online" : "Offline"}{detail.user.banned && " · Banned"}</span></div>
          <dl className="rc-facts"><div><dt>JOINED</dt><dd>{fmt(detail.user.createdAt)}</dd></div><div><dt>LAST SEEN · SGT</dt><dd>{fmt(detail.user.lastSeen)}</dd></div></dl>
          <div className="rc-actions">
            {me?.role === "owner" && !own && !protectedAccount && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="rc-command" disabled={busy}><ShieldPlus size={14} />Rank<ChevronDown size={12} /></Button></DropdownMenuTrigger><DropdownMenuContent className="rc-menu" align="start"><DropdownMenuLabel>ACCOUNT RANK</DropdownMenuLabel><DropdownMenuRadioGroup value={detail.user.role ?? "none"} onValueChange={(role) => { if (role !== "admin" && role !== "mod" && role !== "none") return; void run(async () => { await adminSetMod({ data: { id: detail.user.id, role } }); await refreshSelected(detail.user.id); }); }}>
              <DropdownMenuRadioItem value="admin">Admin</DropdownMenuRadioItem><DropdownMenuRadioItem value="mod">Mod</DropdownMenuRadioItem><DropdownMenuRadioItem value="none">Member</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>}
            {me?.role === "owner" && extras && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="rc-command" disabled={busy}><Sparkles size={14} />Chat rank{extras.chatRank && <RankTag rank={extras.chatRank} accent={detail.user.accent} />}<ChevronDown size={12} /></Button></DropdownMenuTrigger><DropdownMenuContent className="rc-menu" align="start"><DropdownMenuLabel>CHAT RANK</DropdownMenuLabel><DropdownMenuRadioGroup value={extras.chatRank ?? "none"} onValueChange={(value) => { const chatRank = value === "none" ? null : CHAT_RANKS.find((r) => r === value); if (chatRank === undefined) return; void run(async () => { await ownerSetExtras({ data: { id: detail.user.id, chatRank } }); setExtras({ ...extras, chatRank }); }); }}>
              {[...CHAT_RANKS].reverse().map((r) => <DropdownMenuRadioItem key={r} value={r}><RankTag rank={r} accent={detail.user.accent} /><small>{formatBytes(attachmentLimit(null, r))} per message</small></DropdownMenuRadioItem>)}
              <DropdownMenuRadioItem value="none">No rank</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup></DropdownMenuContent></DropdownMenu>}
            {canAct && canRevokeTabs(me?.role ?? null) && <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" className="rc-command" disabled={busy}><SlidersHorizontal size={14} />Access<ChevronDown size={12} /></Button></DropdownMenuTrigger><DropdownMenuContent className="rc-menu" align="start"><DropdownMenuLabel>MENU ACCESS</DropdownMenuLabel>
              {accessItems.map(([tab, label, Icon]) => <DropdownMenuCheckboxItem key={tab} disabled={busy} checked={!detail.user.blockedTabs.includes(tab)} onSelect={(e) => e.preventDefault()} onCheckedChange={(allowed) => void run(async () => {
                const tabs = (allowed ? detail.user.blockedTabs.filter((t) => t !== tab) : [...detail.user.blockedTabs, tab]) as ("browser" | "youtube" | "chat" | "music")[];
                await adminSetBlockedTabs({ data: { id: detail.user.id, tabs } }); await loadDetail(detail.user.id);
              })}><Icon size={14} /><span>{label}</span><small>{detail.user.blockedTabs.includes(tab) ? "Revoked" : "Allowed"}</small></DropdownMenuCheckboxItem>)}
            </DropdownMenuContent></DropdownMenu>}
            {canAct && <Button variant="ghost" disabled={busy} className="rc-command rc-danger" onClick={() => void run(async () => { await adminSetBan({ data: { id: detail.user.id, banned: !detail.user.banned } }); await refreshSelected(detail.user.id); })}>{detail.user.banned ? <ShieldCheck size={14} /> : <Ban size={14} />}{detail.user.banned ? "Unban" : "Ban account"}</Button>}
            {canAct && !protectedAccount && canDeleteAccounts(me?.role ?? null) && <Button variant="ghost" disabled={busy} className="rc-command rc-danger" onClick={() => { if (!window.confirm(`Delete ${detail.user.username} permanently?`)) return; void run(async () => { await adminDeleteUser({ data: { id: detail.user.id } }); setSelected(null); setDetail(null); await loadUsers(); }); }}><Trash2 size={14} />Delete</Button>}
          </div>
           {me?.role === "owner" && (own || canAct) && <details className="rc-security"><summary><KeyRound size={14} />Password reset<ChevronDown size={12} /></summary><PasswordSettings key={detail.user.id} targetId={detail.user.id} /></details>}
          {detail.canViewLogs && <section className="rc-history">
            <header><h3><Activity size={15} />Activity history</h3><span>{detail.activity.length} entries</span></header>
            <div className="rc-history-tabs" role="tablist" aria-label="History type">{filters.map(([key, label]) => <Button variant="ghost" key={key} role="tab" aria-selected={filter === key} className={filter === key ? "is-active" : ""} onClick={() => setFilter(key)}>{label}<small>{detail.activity.filter((a) => a.kind === key).length}</small></Button>)}</div>
            <label className="rc-search rc-history-search"><Search size={14} /><input aria-label="Search history" placeholder="Filter history…" value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} /></label>
            <div className="rc-history-scroll" role="tabpanel" aria-label={`${filter} history`}>
              {filter === "settings" && <pre>{JSON.stringify(detail.user.settings, null, 2)}</pre>}
              {!items.length && <p className="rc-no-results rc-muted">No activity found.</p>}
              <ul>{items.map((a) => <li key={a.id}><span>{a.value}{typeof a.detail["source"] === "string" && <small>{a.detail["source"]}</small>}{a.hidden && <em>Deleted by user</em>}</span><time>{fmt(a.created_at)}</time></li>)}</ul>
            </div>
          </section>}
        </>}
      </section>
    </div>
  </div>;
}
