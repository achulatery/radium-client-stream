import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { RadiumMark } from "@/components/radium-ui";
import { signIn, signUp } from "@/lib/account.functions";
import { useAccount } from "@/lib/account";

export function AuthScreen() {
  const { refresh, banned } = useAccount();
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(banned ? "This account has been banned" : null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return setError("Enter a username and password");
    setBusy(true);
    setError(null);
    try {
      const fn = mode === "create" ? signUp : signIn;
      const r = await fn({ data: { username: username.trim(), password } });
      if (!r.ok) setError(r.error);
      else await refresh();
    } catch {
      setError("Something went wrong, try again");
    } finally {
      setBusy(false);
    }
  };

  const field = {
    background: "var(--rd-search)",
    color: "var(--rd-search-text)",
    border: "1px solid var(--rd-line)",
  };

  return (
    <div className="radium-shell flex min-h-screen items-center justify-center px-4 font-sans" style={{ background: "var(--rd-bg)", color: "var(--rd-text)" }}>
      <div className="w-full max-w-sm rounded-sm p-7" style={{ background: "var(--rd-surface)", border: "1px solid var(--rd-line)" }}>
        <div className="mb-6 flex items-center gap-3">
          <RadiumMark />
          <span className="text-sm font-bold tracking-[0.22em]">RADIUM</span>
          <span className="font-mono text-[9px] tracking-[0.28em]" style={{ color: "var(--rd-muted)" }}>CLIENT</span>
        </div>
        <h1 className="text-xl font-semibold">{mode === "create" ? "Create your Radium account" : "Welcome back"}</h1>
        <p className="mt-1 text-xs" style={{ color: "var(--rd-muted)" }}>
          {mode === "create" ? "Pick any username and password to start your session." : "Sign in to restore your history and settings."}
        </p>
        <form onSubmit={submit} className="mt-6 flex flex-col gap-3">
          <label className="font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>USERNAME</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" className="h-11 rounded-sm px-3 text-sm outline-none" style={field} />
          <label className="mt-1 font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>PASSWORD</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "create" ? "new-password" : "current-password"} className="h-11 rounded-sm px-3 text-sm outline-none" style={field} />
          {error && <p className="text-xs" style={{ color: "var(--rd-accent)" }}>{error}</p>}
          <button disabled={busy} className="mt-2 h-11 rounded-sm text-sm font-semibold tracking-wide disabled:opacity-60" style={{ background: "var(--rd-accent)", color: "var(--rd-bg)" }}>
            {busy ? "Please wait…" : mode === "create" ? "Create account" : "Sign in"}
          </button>
        </form>
        <button onClick={() => { setMode(mode === "create" ? "signin" : "create"); setError(null); }} className="mt-4 w-full text-center text-xs" style={{ color: "var(--rd-accent-alt)" }}>
          {mode === "create" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
        <div className="mt-6 flex items-center gap-2 font-mono text-[10px] tracking-[0.2em]" style={{ color: "var(--rd-muted)" }}>
          <ShieldCheck size={12} style={{ color: "var(--rd-accent-alt)" }} /> RADIUM SESSION
        </div>
      </div>
    </div>
  );
}
