"use client";
import { FormEvent, useState } from "react";

export function ChangePasswordForm() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    setSuccess(false);

    try {
      const response = await fetch("/api/session/change-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          totp: totp.trim() ? totp.trim() : undefined
        })
      });
      const data = await response.json() as { message?: string };
      if (!response.ok) {
        setMessage(data.message ?? "Password update could not be confirmed.");
      } else {
        setSuccess(true);
        setMessage(data.message ?? "Password updated successfully. Other device sessions revoked.");
        setCurrentPassword("");
        setNewPassword("");
        setTotp("");
      }
    } catch {
      setMessage("We couldn't confirm the outcome. Check before submitting again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit} style={{ maxWidth: "480px", marginTop: "16px" }}>
      <h3>Change account password</h3>
      <p style={{ fontSize: "14px", color: "var(--muted)" }}>
        Setting a new password will revoke any active sessions on other devices.
      </p>
      <label className="field">Current password
        <input
          required
          type="password"
          autoComplete="current-password"
          value={currentPassword}
          onChange={e => setCurrentPassword(e.target.value)}
        />
      </label>
      <label className="field">New password (14+ characters)
        <input
          required
          type="password"
          autoComplete="new-password"
          minLength={14}
          value={newPassword}
          onChange={e => setNewPassword(e.target.value)}
        />
      </label>
      <label className="field">Authenticator code (if privileged)
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="6-digit code"
          value={totp}
          onChange={e => setTotp(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      {!!message && (
        <p role="status" className={success ? "success" : "error"} style={{ marginTop: "8px" }}>
          {message}
        </p>
      )}
      <button className="primary" type="submit" disabled={busy} style={{ marginTop: "12px" }}>
        {busy ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}

