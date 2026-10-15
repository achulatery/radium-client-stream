import { useState } from "react";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { changeMyPassword, ownerChangePassword } from "@/lib/account.functions";

export function PasswordSettings({ targetId }: { targetId?: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  return <form className="account-password-form" onSubmit={async (event) => {
    event.preventDefault(); setMessage("");
    if (newPassword !== confirmPassword) { setMessage("Passwords do not match"); return; }
    setBusy(true);
    try {
      if (targetId) await ownerChangePassword({ data: { id: targetId, newPassword } });
      else await changeMyPassword({ data: { currentPassword, newPassword } });
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword(""); setMessage("Password changed");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not change password"); }
    finally { setBusy(false); }
  }}>
    {!targetId && <label>Current password<input required type="password" autoComplete="current-password" maxLength={200} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></label>}
    <label>New password<input required type="password" autoComplete="new-password" maxLength={200} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /></label>
    <label>Confirm new password<input required type="password" autoComplete="new-password" maxLength={200} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /></label>
    <Button variant="secondary" disabled={busy} type="submit"><KeyRound size={14} />{busy ? "Saving…" : "Change password"}</Button>
    {message && <p role="status">{message}</p>}
  </form>;
}