"use client";
import { FormEvent, useRef, useState } from "react";

export function RecoveryForm() {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [channel, setChannel] = useState<"EMAIL" | "SMS">("EMAIL");
  const [identifier, setIdentifier] = useState("");
  const [token, setToken] = useState("");
  const [totp, setTotp] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const requestKey = useRef("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (step === "request" && !requestKey.current) requestKey.current = crypto.randomUUID();
    setBusy(true);
    setMessage("");
    setUncertain(false);

    const path = step === "request" ? "/api/session/recovery/request" : "/api/session/recovery/confirm";
    const body = step === "request"
      ? { identifier: identifier.trim(), channel, requestKey: requestKey.current, email: identifier.trim() }
      : { identifier: identifier.trim(), email: identifier.trim(), token, totp, password };

    try {
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await response.json() as { message?: string; supportReference?: string };
      if (!response.ok) {
        setMessage(response.status === 429 ? "Too many attempts. Try again later." :
          data.message ?? "Recovery cannot be confirmed.");
        if (step === "confirm" && response.status >= 500) setUncertain(true);
      } else {
        setMessage((data.message ?? "Recovery request processed.") +
          (step === "request" && data.supportReference ? " Support reference: " + data.supportReference : ""));
        if (step === "request") setStep("confirm");
        else { setDone(true); setPassword(""); setToken(""); setTotp(""); }
      }
    } catch {
      setMessage("We couldn't confirm the outcome. Check before submitting again.");
      if (step === "confirm") setUncertain(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={submit}>
      {step === "request" && !done && (
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input
              type="radio"
              name="channel"
              value="EMAIL"
              checked={channel === "EMAIL"}
              onChange={() => setChannel("EMAIL")}
            />
            <span>Work email</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
            <input
              type="radio"
              name="channel"
              value="SMS"
              checked={channel === "SMS"}
              onChange={() => setChannel("SMS")}
            />
            <span>Verified SMS</span>
          </label>
        </div>
      )}

      <label className="field">
        {channel === "SMS" && step === "request" ? "Verified mobile number or email" : "Work email"}
        <input
          required
          type={channel === "EMAIL" ? "email" : "text"}
          autoComplete={channel === "EMAIL" ? "email" : "tel"}
          maxLength={254}
          value={identifier}
          placeholder={channel === "SMS" ? "+91..." : "name@foundation.org"}
          onChange={e => setIdentifier(e.target.value)}
          disabled={done}
        />
      </label>

      {step === "confirm" && !done && (
        <>
          <p>
            Enter your recovery code received via {channel === "SMS" ? "SMS" : "email"} and your fresh authenticator code.
          </p>
          <label className="field">Recovery code
            <input
              required
              autoComplete="off"
              value={token}
              onChange={e => setToken(e.target.value)}
              minLength={40}
              maxLength={100}
            />
          </label>
          <label className="field">Authenticator code
            <input
              required
              autoComplete="one-time-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={totp}
              onChange={e => setTotp(e.target.value.replace(/\D/g, ""))}
            />
          </label>
          <label className="field">New password (14+ characters)
            <input
              required
              autoComplete="new-password"
              type="password"
              minLength={14}
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </label>
        </>
      )}

      {!!message && <p role="status" className={uncertain ? "error" : undefined}>{message}</p>}

      {!done && (
        <button className="primary" type="submit" disabled={busy || uncertain}>
          {busy ? "Checking…" : step === "request" ? "Request recovery" : "Confirm recovery"}
        </button>
      )}

      {uncertain && (
        <p>Try signing in with your new password or contact Foundation support before attempting another reset.</p>
      )}

      <a href="/admin/login">Return to sign in</a>
    </form>
  );
}
