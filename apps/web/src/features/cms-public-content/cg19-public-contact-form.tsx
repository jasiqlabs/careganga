"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Clock,
  ExternalLink,
  Mail,
  MapPin,
  Phone,
  Send,
  ShieldCheck,
} from "lucide-react";

type Faq = { faqRef: string; question: string; answer: string };
type Receipt = {
  receipt: string;
  ticketNumber: string;
  expiresAt: string;
  status: string;
  result: string;
};

class SupportActionError extends Error {
  constructor(
    readonly category: "LIMIT" | "CONFLICT" | "INVALID" | "UNKNOWN",
    message: string
  ) {
    super(message);
    this.name = "SupportActionError";
  }
}

async function call<T>(path: string, body: object) {
  let response: Response;
  try {
    response = await fetch("/api/support/" + path, {
      method: "POST",
      credentials: "omit",
      cache: "no-store",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw Error("UNKNOWN");
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const candidate =
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      "message" in body &&
      typeof body.message === "string"
        ? body.message
        : null;
    const safe =
      candidate &&
      candidate.length >= 8 &&
      candidate.length <= 240 &&
      !/[<>\u0000-\u001f\u007f]/.test(candidate)
        ? candidate
        : null;
    const category =
      response.status === 429
        ? "LIMIT"
        : response.status === 409
        ? "CONFLICT"
        : response.status === 400
        ? "INVALID"
        : "UNKNOWN";
    throw new SupportActionError(
      category,
      safe ??
        (category === "LIMIT"
          ? "Too many requests. Try again later."
          : category === "INVALID"
          ? "Check the details in the form before retrying."
          : category === "CONFLICT"
          ? "This request was already used. Review its original status."
          : "The original request outcome is not confirmed. Check its status before retrying.")
    );
  }
  return (await response.json()) as T;
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function safeHttps(value: unknown, hosts: string[]): string {
  const entry = str(value);
  try {
    const url = new URL(entry);
    return url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      hosts.includes(url.hostname.toLowerCase())
      ? entry
      : "";
  } catch {
    return "";
  }
}

export function Cg19PublicContactForm({
  contact: publishedContact = {},
  contactInfo = {},
}: {
  contact?: Record<string, unknown>;
  contactInfo?: Record<string, unknown>;
} = {}) {
  const phone = str(publishedContact.phone);
  const email = str(publishedContact.email);
  const address = str(publishedContact.address);
  const officeHours = str(contactInfo.officeHours);

  const mapUrl = safeHttps(contactInfo.mapUrl, [
    "www.google.com",
    "google.com",
    "maps.google.com",
  ]);
  const embeddedMap = (() => {
    if (!mapUrl) return "";
    try {
      const u = new URL(mapUrl);
      return ["www.google.com", "google.com"].includes(u.hostname.toLowerCase()) &&
        u.pathname === "/maps/embed" &&
        u.searchParams.has("pb")
        ? mapUrl
        : "";
    } catch {
      return "";
    }
  })();

  const allowedSocial: Record<string, string[]> = {
    Facebook: ["facebook.com", "www.facebook.com"],
    Instagram: ["instagram.com", "www.instagram.com"],
    YouTube: ["youtube.com", "www.youtube.com"],
  };
  const rawSocial = Array.isArray(contactInfo.socialLinks)
    ? contactInfo.socialLinks
    : [];
  const safeSocial = rawSocial
    .filter(
      (x): x is Record<string, unknown> =>
        Boolean(x && typeof x === "object" && !Array.isArray(x))
    )
    .map((x) => ({
      network: str(x.network),
      url: allowedSocial[str(x.network)]
        ? safeHttps(x.url, allowedSocial[str(x.network)])
        : "",
    }))
    .filter((x) => x.network && x.url);

  const topics = useMemo(() => {
    const raw = Array.isArray(contactInfo.inquiries)
      ? contactInfo.inquiries
      : [];
    return raw
      .filter(
        (x): x is Record<string, unknown> =>
          Boolean(x && typeof x === "object" && !Array.isArray(x))
      )
      .map((x) => str(x.title))
      .filter((t) => t.length >= 5 && t.length <= 140);
  }, [contactInfo.inquiries]);

  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [message, setMessage] = useState("");
  const [requestKey, setRequestKey] = useState("");
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [proof, setProof] = useState("");
  const [proofState, setProofState] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [errorArea, setErrorArea] = useState<"message" | "receipt">("message");
  const [copyState, setCopyState] = useState("");
  const [faqs, setFaqs] = useState<Faq[]>([]);

  useEffect(() => {
    if (!dropdownOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDropdownOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [dropdownOpen]);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/support/public/faqs", {
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
    })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data: unknown) => {
        if (
          !controller.signal.aborted &&
          data &&
          typeof data === "object" &&
          "faqs" in data &&
          Array.isArray(data.faqs)
        )
          setFaqs((data.faqs as Faq[]).slice(0, 30));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const effectiveSubject =
    topics.length > 0 && selectedTopic !== "__OTHER__"
      ? selectedTopic
      : customSubject;

  async function send(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || receipt) return;
    if (effectiveSubject.trim().length < 5) {
      setErrorArea("message");
      setError("Please choose or enter a subject (at least 5 characters).");
      return;
    }
    setErrorArea("message");
    setError("");
    setBusy(true);
    const key = requestKey || crypto.randomUUID();
    setRequestKey(key);
    try {
      const response = await call<Receipt>("public/contact", {
        requestKey: key,
        name,
        contact,
        subject: effectiveSubject.trim(),
        message,
      });
      if (!response.receipt) throw Error("UNKNOWN");
      setReceipt(response);
      setProof(response.receipt);
      setRequestKey("");
      setMessage("");
      setError("");
    } catch (e) {
      if (
        !requestKey &&
        e instanceof SupportActionError &&
        e.category === "INVALID"
      )
        setRequestKey("");
      setError(
        e instanceof SupportActionError
          ? e.message
          : "Submission could not be confirmed. Retry the same message to recover its original receipt without creating another request."
      );
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (busy || !/^[A-Za-z0-9_-]{43}$/.test(proof.trim())) return;
    setErrorArea("receipt");
    setBusy(true);
    setError("");
    setProofState("");
    try {
      const result = await call<{ status: string; ticketNumber: string }>(
        "receipt/status",
        { receipt: proof.trim() }
      );
      setProofState(
        `${result.ticketNumber} · ${result.status.replaceAll("_", " ")}`
      );
    } catch (e) {
      setError(
        e instanceof SupportActionError
          ? e.message
          : "This receipt could not be verified. Check the original private code."
      );
    } finally {
      setBusy(false);
    }
  }

  const dropdownDisplayLabel =
    selectedTopic === "__OTHER__"
      ? "Other topic"
      : selectedTopic || "Select a topic";

  return (
    <div className="cg-contact-v2-wrap">
      <section
        className="cg-contact-v2-grid"
        aria-label="Foundation Contact and private support"
      >
        {/* Left: Send us a message Card */}
        <div className="cg-contact-v2-card cg-contact-v2-form-card">
          <div className="cg-contact-v2-card-head">
            <h2>Send us a message</h2>
            <p>
              Your message is handled privately by the Foundation support system;
              no account is needed.
            </p>
          </div>

          {receipt ? (
            <section className="cg-contact-v2-receipt" aria-live="polite">
              <div className="cg-contact-v2-receipt-badge">
                <ShieldCheck size={16} aria-hidden="true" />
                <span>Request received</span>
              </div>
              <p className="cg-contact-v2-ticket">
                Ticket number: <strong>{receipt.ticketNumber}</strong>
              </p>
              <p>
                The Foundation recorded your request. Keep this private receipt;
                it expires on {new Date(receipt.expiresAt).toLocaleDateString()}.
              </p>
              <code>{receipt.receipt}</code>
              <div className="cg-contact-v2-receipt-actions">
                <button
                  className="cg-contact-v2-submit"
                  type="button"
                  onClick={() => {
                    setCopyState("");
                    void (async () => {
                      try {
                        await navigator.clipboard.writeText(receipt.receipt);
                        setCopyState("Private receipt copied.");
                      } catch {
                        setCopyState(
                          "Copy unavailable. Select and save the private code shown above."
                        );
                      }
                    })();
                  }}
                >
                  Copy private receipt
                </button>
              </div>
              {copyState && <p role="status">{copyState}</p>}
            </section>
          ) : (
            <form className="cg-contact-v2-form" onSubmit={send}>
              <div className="cg-contact-v2-field">
                <label htmlFor="c-name">
                  Full Name <span aria-hidden="true">*</span>
                </label>
                <input
                  id="c-name"
                  disabled={busy}
                  readOnly={!!requestKey}
                  required
                  minLength={2}
                  maxLength={90}
                  autoComplete="name"
                  placeholder="Enter your full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="cg-contact-v2-field">
                <label htmlFor="c-contact">
                  Email or Phone <span aria-hidden="true">*</span>
                </label>
                <input
                  id="c-contact"
                  disabled={busy}
                  readOnly={!!requestKey}
                  required
                  minLength={5}
                  maxLength={120}
                  autoComplete="email"
                  placeholder="email@example.com or +91..."
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>

              {/* Subject * — Custom Dropdown (populated from CMS inquiries) */}
              <div className="cg-contact-v2-field" ref={dropdownRef}>
                <label id="c-subject-label" htmlFor="c-subject-custom">
                  Subject <span aria-hidden="true">*</span>
                </label>

                {topics.length > 0 ? (
                  <div className="cg-contact-v2-dropdown">
                    <button
                      type="button"
                      disabled={busy || !!requestKey}
                      className={`cg-contact-v2-dd-trigger ${
                        dropdownOpen ? "is-open" : ""
                      } ${!selectedTopic ? "is-placeholder" : ""}`}
                      aria-haspopup="listbox"
                      aria-expanded={dropdownOpen}
                      aria-labelledby="c-subject-label"
                      onClick={() => setDropdownOpen((o) => !o)}
                    >
                      <span>{dropdownDisplayLabel}</span>
                      <ChevronDown
                        size={16}
                        className={`cg-contact-v2-dd-chev ${
                          dropdownOpen ? "is-rotated" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    {dropdownOpen && (
                      <ul
                        className="cg-contact-v2-dd-menu"
                        role="listbox"
                        aria-labelledby="c-subject-label"
                      >
                        {topics.map((topic) => {
                          const active = selectedTopic === topic;
                          return (
                            <li key={topic}>
                              <button
                                type="button"
                                role="option"
                                aria-selected={active}
                                className={`cg-contact-v2-dd-opt ${
                                  active ? "is-selected" : ""
                                }`}
                                onClick={() => {
                                  setSelectedTopic(topic);
                                  setDropdownOpen(false);
                                }}
                              >
                                <span>{topic}</span>
                                {active && <Check size={15} aria-hidden="true" />}
                              </button>
                            </li>
                          );
                        })}
                        <li>
                          <button
                            type="button"
                            role="option"
                            aria-selected={selectedTopic === "__OTHER__"}
                            className={`cg-contact-v2-dd-opt ${
                              selectedTopic === "__OTHER__" ? "is-selected" : ""
                            }`}
                            onClick={() => {
                              setSelectedTopic("__OTHER__");
                              setDropdownOpen(false);
                            }}
                          >
                            <span>Other topic</span>
                            {selectedTopic === "__OTHER__" && (
                              <Check size={15} aria-hidden="true" />
                            )}
                          </button>
                        </li>
                      </ul>
                    )}
                  </div>
                ) : null}

                {(topics.length === 0 || selectedTopic === "__OTHER__") && (
                  <input
                    id="c-subject-custom"
                    disabled={busy}
                    readOnly={!!requestKey}
                    required
                    minLength={5}
                    maxLength={140}
                    placeholder="Write your subject..."
                    value={customSubject}
                    onChange={(e) => setCustomSubject(e.target.value)}
                  />
                )}
              </div>

              <div className="cg-contact-v2-field">
                <label htmlFor="c-message">
                  Message <span aria-hidden="true">*</span>
                </label>
                <textarea
                  id="c-message"
                  disabled={busy}
                  readOnly={!!requestKey}
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={5}
                  placeholder="Tell us how we can help..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
              </div>

              <p className="cg-contact-v2-privacy">
                Your details are visible only to authorized Foundation support
                staff.
              </p>

              {requestKey && !busy && (
                <p className="cg-contact-v2-retry-note" role="status">
                  Retry the original request without changing its details to
                  avoid a duplicate submission.
                </p>
              )}

              <button
                className="cg-contact-v2-submit"
                disabled={busy}
                type="submit"
              >
                <Send size={16} aria-hidden="true" />
                <span>
                  {busy && errorArea === "message"
                    ? "Sending private request…"
                    : requestKey
                    ? "Retry private request"
                    : "Send Message"}
                </span>
              </button>
            </form>
          )}
          {error && errorArea === "message" && (
            <p className="cg-cms-error" role="alert">
              {error}
            </p>
          )}
        </div>

        {/* Right Column: Contact Info + Map + Receipt Check + Social */}
        <aside className="cg-contact-v2-side">
          {(phone || email || address || officeHours) && (
            <section className="cg-contact-v2-card">
              <h2 className="cg-contact-v2-side-title">Contact Information</h2>
              <ul className="cg-contact-v2-info-list">
                {address && (
                  <li>
                    <MapPin size={18} className="cg-contact-v2-ico" aria-hidden="true" />
                    <div>
                      <strong>Foundation Office</strong>
                      <span>{address}</span>
                    </div>
                  </li>
                )}
                {phone && (
                  <li>
                    <Phone size={18} className="cg-contact-v2-ico" aria-hidden="true" />
                    <div>
                      <a href={"tel:" + phone.replace(/[^+0-9]/g, "")}>{phone}</a>
                    </div>
                  </li>
                )}
                {email && (
                  <li>
                    <Mail size={18} className="cg-contact-v2-ico" aria-hidden="true" />
                    <div>
                      <a href={"mailto:" + email}>{email}</a>
                    </div>
                  </li>
                )}
                {officeHours && (
                  <li>
                    <Clock size={18} className="cg-contact-v2-ico" aria-hidden="true" />
                    <div>
                      <span>{officeHours}</span>
                    </div>
                  </li>
                )}
              </ul>
            </section>
          )}

          {mapUrl && (
            <section className="cg-contact-v2-card cg-contact-v2-map-card">
              {embeddedMap && (
                <iframe
                  className="cg-contact-v2-map-frame"
                  title="Foundation location on Google Maps"
                  src={embeddedMap}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              )}
              <div className="cg-contact-v2-map-foot">
                <a
                  href={mapUrl}
                  rel="noopener noreferrer"
                  target="_blank"
                  className="cg-contact-v2-map-link"
                >
                  <span>Open in Maps</span>
                  <ExternalLink size={14} aria-hidden="true" />
                </a>
              </div>
            </section>
          )}

          <section className="cg-contact-v2-card">
            <h2 className="cg-contact-v2-side-title">Check a private receipt</h2>
            <p className="cg-contact-v2-side-desc">
              Enter the receipt supplied when you submitted. Only the current
              status is shown; private messages are never exposed here.
            </p>
            <div className="cg-contact-v2-field">
              <label htmlFor="c-receipt">Private receipt code</label>
              <input
                id="c-receipt"
                disabled={busy}
                value={proof}
                placeholder="Paste your 43-character receipt code"
                onChange={(e) => {
                  setProof(e.target.value.trim());
                  setProofState("");
                  if (errorArea === "receipt") setError("");
                }}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <button
              type="button"
              className="cg-contact-v2-btn-secondary"
              disabled={busy || !/^[A-Za-z0-9_-]{43}$/.test(proof.trim())}
              onClick={() => void check()}
            >
              {busy && errorArea === "receipt"
                ? "Checking request status…"
                : "Check request status"}
            </button>
            {proofState && (
              <p className="cg-contact-v2-status-pill" role="status">
                Current status: {proofState}
              </p>
            )}
            {error && errorArea === "receipt" && (
              <p className="cg-cms-error" role="alert">
                {error}
              </p>
            )}
          </section>

          {safeSocial.length > 0 && (
            <section className="cg-contact-v2-social-card">
              <h2>Follow Our Work</h2>
              <p>Stay updated on active campaigns, ground events, and impact stories.</p>
              <div className="cg-contact-v2-social-links">
                {safeSocial.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.network}
                  </a>
                ))}
              </div>
            </section>
          )}
        </aside>
      </section>

      {faqs.length > 0 && (
        <section className="cg-contact-v2-faq-section">
          <h2>Support FAQs</h2>
          <div className="cg-contact-v2-faq-list">
            {faqs.map((f) => (
              <details key={f.faqRef} className="cg-contact-v2-faq-item">
                <summary>{f.question}</summary>
                <p>{f.answer}</p>
              </details>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
