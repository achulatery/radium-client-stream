import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { getMe, signOut as signOutFn } from "./account.functions";

export type AccountUser = {
  id: string;
  username: string;
  isAdmin: boolean;
  role: "owner" | "mod" | null;
  settings: Record<string, unknown>;
};

type Ctx = {
  loading: boolean;
  user: AccountUser | null;
  banned: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AccountContext = createContext<Ctx | null>(null);

export function AccountProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<AccountUser | null>(null);
  const [banned, setBanned] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await getMe();
      setUser(r.user);
      setBanned(r.banned);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await signOutFn();
    setUser(null);
  }, []);

  return (
    <AccountContext.Provider value={{ loading, user, banned, refresh, signOut }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}
