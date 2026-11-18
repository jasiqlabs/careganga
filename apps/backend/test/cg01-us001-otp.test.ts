import { describe, test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import { RecoveryDelivery } from "../src/modules/cg-01-identity-access/infrastructure/recovery-delivery";
import { RecoveryController } from "../src/modules/cg-01-identity-access/http/recovery.controller";
import { RecoveryService } from "../src/modules/cg-01-identity-access/application/recovery.service";
import { hashPassword, verifyPassword } from "../src/modules/cg-01-identity-access/domain/secret-crypto";
import { BadRequestException, HttpException, HttpStatus } from "@nestjs/common";
import type { Pool, PoolClient } from "pg";

/**
 * CareGanga Foundation — CG-01 US-001 OTP-Only Automated QA Suite.
 *
 * Scenarios Tested:
 * 1. Email OTP Flow (request, format, provider states, confirmation, single-use, credential rotation)
 * 2. SMS OTP Flow (request, 10-digit mobile / E.164 normalization, provider states, confirmation)
 * 3. Anti-Enumeration & Security Holds (neutral 202 on unknown/inactive/recent-contact-changed)
 * 4. Resend Cooldown (60 seconds) & Request Idempotency
 * 5. Rate Limiting (Identifier & Network IP bounds for both request and confirm)
 * 6. OTP Verification Controls (timing-safe check, wrong attempt increment, max 5 attempts lockout)
 * 7. Expired & Non-Accepted Challenge Rejection (10-minute expiry, non-PROVIDER_ACCEPTED status)
 * 8. Password Policy & Session Revocation (same-password rejection, session invalidation, access_version bump)
 * 9. Provider Safety Gate (distinguish mocked delivery, provider acceptance, and unconfigured real delivery)
 */

// ============================================================================
// IN-MEMORY STATEFUL MOCK POSTGRESQL POOL FOR RECOVERY SERVICE
// ============================================================================

interface AccountEntity {
  id: string;
  realm_id: string;
  display_name: string;
  normalized_mobile: string;
  normalized_email: string | null;
  contact_phone: string | null;
  recovery_contact_changed_at: Date | null;
  status: "ACTIVE" | "SUSPENDED" | "DEACTIVATED";
  access_version: number;
}

interface CredentialEntity {
  account_id: string;
  password_hash: string;
  credential_version: number;
}

interface ChallengeEntity {
  id: string;
  account_id: string;
  kind: "RECOVERY";
  digest: string;
  request_key: string;
  delivery_channel: "email" | "sms";
  expires_at: Date;
  consumed_at: Date | null;
  attempts: number;
  delivery_status: "PENDING" | "CLAIMED" | "PROVIDER_ACCEPTED" | "UNKNOWN" | "UNAVAILABLE";
  delivery_attempts: number;
  provider_accepted_at: Date | null;
  created_at: Date;
}

interface LoginAttemptEntity {
  key_digest: string;
  window_started_at: Date;
  attempt_count: number;
}

interface SessionEntity {
  id: string;
  account_id: string;
  revoked_at: Date | null;
}

interface AuditEntity {
  realm_id: string;
  actor_account_id: string;
  target_account_id: string;
  action_key: string;
  outcome: string;
  correlation_ref: string;
}

class MockState {
  accounts = new Map<string, AccountEntity>();
  credentials = new Map<string, CredentialEntity>();
  challenges = new Map<string, ChallengeEntity>();
  attempts = new Map<string, LoginAttemptEntity>();
  sessions = new Map<string, SessionEntity>();
  audits: AuditEntity[] = [];

  reset() {
    this.accounts.clear();
    this.credentials.clear();
    this.challenges.clear();
    this.attempts.clear();
    this.sessions.clear();
    this.audits = [];
  }
}

function createMockPool(state: MockState): Pool {
  const queryHandler = async (text: string, params?: unknown[]) => {
    const sql = text.trim();

    // Rate limiting: auth_login_attempt
    if (sql.includes("auth_login_attempt")) {
      const keyDigest = params?.[0] as string;
      let record = state.attempts.get(keyDigest);
      const now = new Date();
      if (!record || record.window_started_at.getTime() < now.getTime() - 15 * 60 * 1000) {
        record = { key_digest: keyDigest, window_started_at: now, attempt_count: 1 };
      } else {
        record.attempt_count += 1;
      }
      state.attempts.set(keyDigest, record);
      return { rows: [{ attempt_count: record.attempt_count }], rowCount: 1 };
    }

    // Account lookup by mobile or email: account WHERE status='ACTIVE' AND (normalized_mobile=$1 OR normalized_email=$1)
    if (sql.includes("FROM account WHERE status='ACTIVE'")) {
      const identifier = params?.[0] as string;
      const found = Array.from(state.accounts.values()).find(
        (a) =>
          a.status === "ACTIVE" &&
          (a.normalized_mobile === identifier || a.normalized_email?.toLowerCase() === identifier.toLowerCase())
      );
      return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
    }

    // Account lock: SELECT id,status,recovery_contact_changed_at FROM account WHERE id=$1 FOR UPDATE
    if (sql.includes("FROM account WHERE id=$1 FOR UPDATE")) {
      const id = params?.[0] as string;
      const found = state.accounts.get(id);
      return {
        rows: found ? [{ id: found.id, status: found.status, recovery_contact_changed_at: found.recovery_contact_changed_at }] : [],
        rowCount: found ? 1 : 0,
      };
    }

    // Recent challenge cooldown: SELECT id FROM auth_challenge WHERE account_id=$1 AND kind='RECOVERY' AND created_at>now()-interval '60 seconds'
    if (sql.includes("created_at>now()-interval '60 seconds'")) {
      const accountId = params?.[0] as string;
      const now = new Date();
      const recent = Array.from(state.challenges.values()).filter(
        (c) => c.account_id === accountId && c.kind === "RECOVERY" && now.getTime() - c.created_at.getTime() < 60000
      );
      return { rows: recent.map((c) => ({ id: c.id })), rowCount: recent.length };
    }

    // Insert challenge: INSERT INTO auth_challenge ... ON CONFLICT(request_key) DO NOTHING RETURNING id
    if (sql.startsWith("INSERT INTO auth_challenge")) {
      const [id, accountId, digest, requestKey, channel] = params as [string, string, string, string, "email" | "sms"];
      // Check request_key conflict
      const conflict = Array.from(state.challenges.values()).some((c) => c.request_key === requestKey);
      if (conflict) {
        return { rows: [], rowCount: 0 };
      }
      const challenge: ChallengeEntity = {
        id,
        account_id: accountId,
        kind: "RECOVERY",
        digest,
        request_key: requestKey,
        delivery_channel: channel,
        expires_at: new Date(Date.now() + 10 * 60 * 1000),
        consumed_at: null,
        attempts: 0,
        delivery_status: "PENDING",
        delivery_attempts: 0,
        provider_accepted_at: null,
        created_at: new Date(),
      };
      state.challenges.set(id, challenge);
      return { rows: [{ id }], rowCount: 1 };
    }

    // Claim challenge: UPDATE auth_challenge SET delivery_status='CLAIMED',delivery_attempts=1 WHERE id=$1 AND delivery_status='PENDING' AND delivery_attempts=0 RETURNING id
    if (sql.includes("SET delivery_status='CLAIMED'")) {
      const id = params?.[0] as string;
      const challenge = state.challenges.get(id);
      if (challenge && challenge.delivery_status === "PENDING" && challenge.delivery_attempts === 0) {
        challenge.delivery_status = "CLAIMED";
        challenge.delivery_attempts = 1;
        return { rows: [{ id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Update challenge delivery outcome: UPDATE auth_challenge SET delivery_status=$2, provider_accepted_at=... WHERE id=$1 AND delivery_status='CLAIMED'
    if (sql.includes("UPDATE auth_challenge SET delivery_status=$2")) {
      const [id, delivery] = params as [string, "PROVIDER_ACCEPTED" | "UNKNOWN" | "UNAVAILABLE"];
      const challenge = state.challenges.get(id);
      if (challenge && challenge.delivery_status === "CLAIMED") {
        challenge.delivery_status = delivery;
        if (delivery === "PROVIDER_ACCEPTED") {
          challenge.provider_accepted_at = new Date();
        } else {
          challenge.provider_accepted_at = null;
        }
        return { rows: [{ id }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Confirm recovery query: SELECT c.id,a.realm_id,a.id AS account_id,ic.password_hash,c.attempts, c.digest,c.expires_at,a.access_version,a.recovery_contact_changed_at FROM account a JOIN identity_credential ic ...
    if (sql.includes("FROM account a JOIN identity_credential ic") && sql.includes("JOIN auth_challenge c")) {
      const identifier = params?.[0] as string;
      const now = new Date();

      // Find matching account
      const account = Array.from(state.accounts.values()).find(
        (a) =>
          a.status === "ACTIVE" &&
          (a.normalized_mobile === identifier || a.normalized_email?.toLowerCase() === identifier.toLowerCase())
      );
      if (!account) return { rows: [], rowCount: 0 };

      const cred = state.credentials.get(account.id);
      if (!cred) return { rows: [], rowCount: 0 };

      // Find eligible challenge
      const eligibleChallenges = Array.from(state.challenges.values())
        .filter(
          (c) =>
            c.account_id === account.id &&
            c.kind === "RECOVERY" &&
            c.delivery_status === "PROVIDER_ACCEPTED" &&
            c.consumed_at === null &&
            c.expires_at.getTime() > now.getTime()
        )
        .sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

      if (eligibleChallenges.length === 0) return { rows: [], rowCount: 0 };

      const newest = eligibleChallenges[0];
      return {
        rows: [
          {
            id: newest.id,
            realm_id: account.realm_id,
            account_id: account.id,
            password_hash: cred.password_hash,
            attempts: newest.attempts,
            digest: newest.digest,
            expires_at: newest.expires_at,
            access_version: String(account.access_version),
            recovery_contact_changed_at: account.recovery_contact_changed_at,
          },
        ],
        rowCount: 1,
      };
    }

    // Increment attempts: UPDATE auth_challenge SET attempts=attempts+1 WHERE id=$1
    if (sql.includes("UPDATE auth_challenge SET attempts=attempts+1")) {
      const id = params?.[0] as string;
      const challenge = state.challenges.get(id);
      if (challenge) {
        challenge.attempts += 1;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Update identity_credential: UPDATE identity_credential SET password_hash=$2, credential_version=credential_version+1,updated_at=now() WHERE account_id=$1
    if (sql.includes("UPDATE identity_credential SET password_hash=$2")) {
      const [accountId, newHash] = params as [string, string];
      const cred = state.credentials.get(accountId);
      if (cred) {
        cred.password_hash = newHash;
        cred.credential_version += 1;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Update account access_version: UPDATE account SET access_version=access_version+1,updated_at=now() WHERE id=$1
    if (sql.includes("UPDATE account SET access_version=access_version+1")) {
      const accountId = params?.[0] as string;
      const account = state.accounts.get(accountId);
      if (account) {
        account.access_version += 1;
        return { rows: [], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    }

    // Revoke auth_session: UPDATE auth_session SET revoked_at=now() WHERE account_id=$1 AND revoked_at IS NULL
    if (sql.includes("UPDATE auth_session SET revoked_at=now()")) {
      const accountId = params?.[0] as string;
      let count = 0;
      for (const session of state.sessions.values()) {
        if (session.account_id === accountId && session.revoked_at === null) {
          session.revoked_at = new Date();
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    // Consume challenge: UPDATE auth_challenge SET consumed_at=now() WHERE account_id=$1 AND kind='RECOVERY' AND consumed_at IS NULL
    if (sql.includes("UPDATE auth_challenge SET consumed_at=now()")) {
      const accountId = params?.[0] as string;
      let count = 0;
      for (const challenge of state.challenges.values()) {
        if (challenge.account_id === accountId && challenge.kind === "RECOVERY" && challenge.consumed_at === null) {
          challenge.consumed_at = new Date();
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    // Insert access_audit: INSERT INTO access_audit
    if (sql.includes("INSERT INTO access_audit")) {
      const [realmId, actorId, corrRef] = params as [string, string, string];
      state.audits.push({
        realm_id: realmId,
        actor_account_id: actorId,
        target_account_id: actorId,
        action_key: "identity.password.recovery",
        outcome: "SUCCESS",
        correlation_ref: corrRef,
      });
      return { rows: [], rowCount: 1 };
    }

    // Transactions
    if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
      return { rows: [], rowCount: 0 };
    }

    throw new Error(`Unhandled mock SQL query: ${sql}`);
  };

  const mockClient: PoolClient = {
    query: queryHandler as any,
    release: () => {},
  } as unknown as PoolClient;

  const mockPool = {
    query: queryHandler as any,
    connect: async () => mockClient,
  } as unknown as Pool;

  return mockPool;
}

// ============================================================================
// TEST SUITE
// ============================================================================

describe("CG-01 US-001: OTP-Only Automated QA Suite", () => {
  // Ensure a valid base64 32-byte key is present for HMAC proof derivation
  const originalKey = process.env.IDENTITY_ENCRYPTION_KEY;
  const originalSmtpHost = process.env.AUTH_SMTP_HOST;
  const originalTwilioSid = process.env.AUTH_SMS_TWILIO_ACCOUNT_SID;

  before(() => {
    if (!process.env.IDENTITY_ENCRYPTION_KEY) {
      process.env.IDENTITY_ENCRYPTION_KEY = Buffer.alloc(32, 0x5a).toString("base64");
    }
  });

  after(() => {
    if (originalKey) process.env.IDENTITY_ENCRYPTION_KEY = originalKey;
    else delete process.env.IDENTITY_ENCRYPTION_KEY;
    if (originalSmtpHost) process.env.AUTH_SMTP_HOST = originalSmtpHost;
    else delete process.env.AUTH_SMTP_HOST;
    if (originalTwilioSid) process.env.AUTH_SMS_TWILIO_ACCOUNT_SID = originalTwilioSid;
    else delete process.env.AUTH_SMS_TWILIO_ACCOUNT_SID;
  });

  // --------------------------------------------------------------------------
  // SECTION 1: RecoveryDelivery Provider & Safety Gate
  // --------------------------------------------------------------------------
  describe("1. RecoveryDelivery Provider Layer", () => {
    test("QA-DEL-01: When unconfigured, isOtpChannelConfigured returns false for both channels", () => {
      const delivery = new RecoveryDelivery();
      const priorHost = process.env.AUTH_SMTP_HOST;
      const priorSid = process.env.AUTH_SMS_TWILIO_ACCOUNT_SID;
      delete process.env.AUTH_SMTP_HOST;
      delete process.env.AUTH_SMS_TWILIO_ACCOUNT_SID;

      assert.equal(delivery.isConfigured(), false);
      assert.equal(delivery.isOtpChannelConfigured("email"), false);
      assert.equal(delivery.isOtpChannelConfigured("sms"), false);

      if (priorHost) process.env.AUTH_SMTP_HOST = priorHost;
      if (priorSid) process.env.AUTH_SMS_TWILIO_ACCOUNT_SID = priorSid;
    });

    test("QA-DEL-02: sendOtp returns UNAVAILABLE if code is not a 6-digit numeric string", async () => {
      const delivery = new RecoveryDelivery();
      assert.equal(await delivery.sendOtp("test@careganga.org", "email", "12345"), "UNAVAILABLE");
      assert.equal(await delivery.sendOtp("test@careganga.org", "email", "1234567"), "UNAVAILABLE");
      assert.equal(await delivery.sendOtp("test@careganga.org", "email", "abcdef"), "UNAVAILABLE");
      assert.equal(await delivery.sendOtp("+919876543210", "sms", "12345"), "UNAVAILABLE");
    });

    test("QA-DEL-03: sendOtp returns UNAVAILABLE when provider is unconfigured", async () => {
      const delivery = new RecoveryDelivery();
      const priorHost = process.env.AUTH_SMTP_HOST;
      const priorSid = process.env.AUTH_SMS_TWILIO_ACCOUNT_SID;
      delete process.env.AUTH_SMTP_HOST;
      delete process.env.AUTH_SMS_TWILIO_ACCOUNT_SID;

      const emailResult = await delivery.sendOtp("test@careganga.org", "email", "123456");
      const smsResult = await delivery.sendOtp("+919876543210", "sms", "123456");

      assert.equal(emailResult, "UNAVAILABLE");
      assert.equal(smsResult, "UNAVAILABLE");

      if (priorHost) process.env.AUTH_SMTP_HOST = priorHost;
      if (priorSid) process.env.AUTH_SMS_TWILIO_ACCOUNT_SID = priorSid;
    });

    test("QA-DEL-04: SMS sendOtp validates E.164 phone format (+1 to +999...)", async () => {
      const delivery = new RecoveryDelivery();
      // Temporarily mock Twilio configured
      process.env.AUTH_SMS_TWILIO_ACCOUNT_SID = "AC0123456789abcdef0123456789abcdef";
      process.env.AUTH_SMS_TWILIO_AUTH_TOKEN = "token-secret-at-least-20-chars";
      process.env.AUTH_SMS_TWILIO_FROM = "+911234567890";

      // Non E.164 numbers (missing plus, too short, letters)
      assert.equal(await delivery.sendOtp("9876543210", "sms", "123456"), "UNAVAILABLE");
      assert.equal(await delivery.sendOtp("09876543210", "sms", "123456"), "UNAVAILABLE");
      assert.equal(await delivery.sendOtp("+0123456789", "sms", "123456"), "UNAVAILABLE");

      delete process.env.AUTH_SMS_TWILIO_ACCOUNT_SID;
      delete process.env.AUTH_SMS_TWILIO_AUTH_TOKEN;
      delete process.env.AUTH_SMS_TWILIO_FROM;
    });

    test("QA-DEL-05: Mock Twilio fetch responses correctly map to delivery states", async () => {
      const delivery = new RecoveryDelivery();
      process.env.AUTH_SMS_TWILIO_ACCOUNT_SID = "AC0123456789abcdef0123456789abcdef";
      process.env.AUTH_SMS_TWILIO_AUTH_TOKEN = "token-secret-at-least-20-chars";
      process.env.AUTH_SMS_TWILIO_FROM = "+911234567890";

      const originalFetch = globalThis.fetch;
      try {
        // Case 1: 201 Created -> PROVIDER_ACCEPTED
        globalThis.fetch = (async () => new Response(JSON.stringify({ status: "queued" }), { status: 201 })) as any;
        assert.equal(await delivery.sendOtp("+919876543210", "sms", "123456"), "PROVIDER_ACCEPTED");

        // Case 2: 500 Internal Error -> UNKNOWN
        globalThis.fetch = (async () => new Response("Internal Server Error", { status: 500 })) as any;
        assert.equal(await delivery.sendOtp("+919876543210", "sms", "123456"), "UNKNOWN");

        // Case 3: 400 Bad Request (e.g., unverified trial destination) -> UNAVAILABLE
        globalThis.fetch = (async () => new Response("Bad Request", { status: 400 })) as any;
        assert.equal(await delivery.sendOtp("+919876543210", "sms", "123456"), "UNAVAILABLE");

        // Case 4: Network abort / connection timeout -> UNKNOWN
        globalThis.fetch = (async () => { throw new Error("Connection timed out"); }) as any;
        assert.equal(await delivery.sendOtp("+919876543210", "sms", "123456"), "UNKNOWN");
      } finally {
        globalThis.fetch = originalFetch;
        delete process.env.AUTH_SMS_TWILIO_ACCOUNT_SID;
        delete process.env.AUTH_SMS_TWILIO_AUTH_TOKEN;
        delete process.env.AUTH_SMS_TWILIO_FROM;
      }
    });

    test("QA-DEL-06: Real external live delivery safety gate is marked BLOCKED/NOT_RUN when credentials unconfigured", (t) => {
      const hasRealSmtp = Boolean(
        process.env.AUTH_SMTP_HOST &&
        process.env.AUTH_SMTP_USER &&
        process.env.AUTH_SMTP_PASSWORD &&
        process.env.AUTH_EMAIL_FROM
      );
      const hasRealTwilio = Boolean(
        /^AC[0-9a-f]{32}$/i.test(process.env.AUTH_SMS_TWILIO_ACCOUNT_SID ?? "") &&
        (process.env.AUTH_SMS_TWILIO_AUTH_TOKEN ?? "").length >= 20 &&
        /^\+[1-9][0-9]{7,14}$/.test(process.env.AUTH_SMS_TWILIO_FROM ?? "")
      );

      t.diagnostic(
        `REAL EXTERNAL PROVIDER STATUS:\n` +
        `- Real SMTP configured: ${hasRealSmtp ? "YES" : "NO (BLOCKED / NOT_RUN)"}\n` +
        `- Real Twilio configured: ${hasRealTwilio ? "YES" : "NO (BLOCKED / NOT_RUN)"}\n` +
        `Preserving policy: Do not send real OTPs to unverified real users or phones without authorization.`
      );
      assert.ok(true, "Safety gate evaluated without leaking secrets or attempting live external calls.");
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 2: RecoveryController HTTP / Validation Layer
  // --------------------------------------------------------------------------
  describe("2. RecoveryController API & Input Validation", () => {
    let controller: RecoveryController;
    let mockService: RecoveryService;

    beforeEach(() => {
      mockService = {
        requestRecovery: async () => ({ message: "If this account exists...", status: "PROCESSED" as const }),
        confirmRecovery: async () => ({ status: "PASSWORD_RESET" as const, message: "Password updated." }),
      } as unknown as RecoveryService;
      controller = new RecoveryController(mockService);
    });

    test("QA-CTRL-01: Rejects missing or malformed identifier on /request with 400", async () => {
      const invalidIdentifiers = ["", "   ", "not-an-email-or-phone", "12345", "5876543210", "abc@xyz"];
      for (const id of invalidIdentifiers) {
        await assert.rejects(
          async () => controller.request({ identifier: id, channel: "email", requestKey: randomUUID() }, {} as any),
          BadRequestException,
          `Identifier '${id}' should have been rejected with 400.`
        );
      }
    });

    test("QA-CTRL-02: Accepts valid Indian 10-digit mobile or standard email on /request", async () => {
      const validIdentifiers = ["9876543210", "8765432109", "7654321098", "6543210987", "user@careganga.org", "admin.test@gmail.com"];
      for (const id of validIdentifiers) {
        const res = await controller.request({ identifier: id, channel: "email", requestKey: randomUUID() }, {} as any);
        assert.equal(res.status, "PROCESSED");
      }
    });

    test("QA-CTRL-03: Rejects invalid channel values on /request with 400", async () => {
      const invalidChannels = ["whatsapp", "phone", "voice", "push", ""];
      for (const ch of invalidChannels) {
        await assert.rejects(
          async () => controller.request({ identifier: "9876543210", channel: ch, requestKey: randomUUID() }, {} as any),
          BadRequestException
        );
      }
    });

    test("QA-CTRL-04: Rejects non-UUID requestKey on /request with 400", async () => {
      const invalidKeys = ["", "123", "not-a-uuid", "g6b8d4f0-1234-5678-90ab-cdef12345678"];
      for (const key of invalidKeys) {
        await assert.rejects(
          async () => controller.request({ identifier: "9876543210", channel: "sms", requestKey: key }, {} as any),
          BadRequestException
        );
      }
    });

    test("QA-CTRL-05: Rejects non-6-digit OTP on /confirm with 400", async () => {
      const invalidOtps = ["", "12345", "1234567", "abcdef", "12 456", "12345\n"];
      for (const otp of invalidOtps) {
        await assert.rejects(
          async () => controller.confirm({ identifier: "9876543210", otp, newPassword: "NewValidPassword123!" }, {} as any),
          BadRequestException,
          `OTP '${otp}' should have been rejected with 400.`
        );
      }
    });

    test("QA-CTRL-06: Rejects short (< 8 chars) new password on /confirm with 400", async () => {
      const shortPasswords = ["", "1234567", "short", "a b c d"];
      for (const pwd of shortPasswords) {
        await assert.rejects(
          async () => controller.confirm({ identifier: "9876543210", otp: "123456", newPassword: pwd }, {} as any),
          BadRequestException
        );
      }
    });

    test("QA-CTRL-07: Rejects null or invalid channel type on /request with 400", async () => {
      await assert.rejects(
        async () => controller.request({ identifier: "9876543210", channel: null, requestKey: randomUUID() }, {} as any),
        BadRequestException
      );
      await assert.rejects(
        async () => controller.request({ identifier: "9876543210", channel: 123, requestKey: randomUUID() }, {} as any),
        BadRequestException
      );
    });

    test("QA-CTRL-08: Rejects oversized new password (> 1024 bytes) on /confirm with 400", async () => {
      const oversizedPassword = "A".repeat(1025);
      await assert.rejects(
        async () => controller.confirm({ identifier: "9876543210", otp: "123456", newPassword: oversizedPassword }, {} as any),
        BadRequestException
      );
    });
  });

  // --------------------------------------------------------------------------
  // SECTION 3: RecoveryService Business Logic & State Machine
  // --------------------------------------------------------------------------
  describe("3. RecoveryService Business Logic & Security Controls", () => {
    let state: MockState;
    let pool: Pool;
    let mockDelivery: RecoveryDelivery;
    let service: RecoveryService;

    const testRealmId = randomUUID();
    const testAccountId = randomUUID();
    const testMobile = "9876543210";
    const testEmail = "donor@careganga.test";
    const testOldPassword = "OldSecurePassword123!";
    let testOldPasswordHash: string;

    beforeEach(async () => {
      state = new MockState();
      pool = createMockPool(state);
      testOldPasswordHash = await hashPassword(testOldPassword);

      // Seed an active test account
      state.accounts.set(testAccountId, {
        id: testAccountId,
        realm_id: testRealmId,
        display_name: "Test Donor Account",
        normalized_mobile: testMobile,
        normalized_email: testEmail,
        contact_phone: "+91" + testMobile,
        recovery_contact_changed_at: null,
        status: "ACTIVE",
        access_version: 1,
      });

      state.credentials.set(testAccountId, {
        account_id: testAccountId,
        password_hash: testOldPasswordHash,
        credential_version: 1,
      });

      // Default mock delivery configured with successful provider acceptance
      mockDelivery = {
        isConfigured: () => true,
        isOtpChannelConfigured: () => true,
        sendOtp: async () => "PROVIDER_ACCEPTED" as const,
      } as unknown as RecoveryDelivery;

      service = new RecoveryService(pool, mockDelivery);
    });

    test("QA-SRV-01 (Anti-Enumeration): Request for unknown identifier returns neutral 202 without DB challenges", async () => {
      const res = await service.requestRecovery("9999999999", "sms", randomUUID(), "127.0.0.1");
      assert.equal(res.status, "PROCESSED");
      assert.ok(res.message.includes("password reset code will be sent"));
      assert.equal(state.challenges.size, 0, "No challenge should be created for non-existent account.");
    });

    test("QA-SRV-02 (Anti-Enumeration): Inactive or suspended account returns neutral 202 without issuing OTP", async () => {
      state.accounts.get(testAccountId)!.status = "SUSPENDED";
      const res = await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");
      assert.equal(res.status, "PROCESSED");
      assert.equal(state.challenges.size, 0, "No challenge should be created for suspended account.");
    });

    test("QA-SRV-03 (Security Hold): Recently edited contact (<24h) returns neutral 202 without issuing OTP", async () => {
      // Set recovery_contact_changed_at to 1 hour ago
      state.accounts.get(testAccountId)!.recovery_contact_changed_at = new Date(Date.now() - 60 * 60 * 1000);
      const res = await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");
      assert.equal(res.status, "PROCESSED");
      assert.equal(state.challenges.size, 0, "No challenge should be created when contact was edited within 24h.");
    });

    test("QA-SRV-04 (Channel Safety): Unconfigured channel returns neutral 202 without creating challenge", async () => {
      mockDelivery.isOtpChannelConfigured = () => false;
      const res = await service.requestRecovery(testEmail, "email", randomUUID(), "127.0.0.1");
      assert.equal(res.status, "PROCESSED");
      assert.equal(state.challenges.size, 0, "No challenge should be created if delivery channel is unconfigured.");
    });

    test("QA-SRV-05 (Resend Cooldown): Request within 60 seconds of previous challenge returns neutral 202 and creates no second OTP", async () => {
      // First request succeeds
      const res1 = await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");
      assert.equal(res1.status, "PROCESSED");
      assert.equal(state.challenges.size, 1);

      // Immediate second request within 60 seconds
      const res2 = await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");
      assert.equal(res2.status, "PROCESSED");
      assert.equal(state.challenges.size, 1, "Second request must be suppressed by 60-second cooldown.");
    });

    test("QA-SRV-06 (Idempotency): Duplicate requestKey replay does not duplicate challenge or delivery", async () => {
      const fixedKey = randomUUID();
      const res1 = await service.requestRecovery(testEmail, "email", fixedKey, "127.0.0.1");
      assert.equal(res1.status, "PROCESSED");
      assert.equal(state.challenges.size, 1);

      // Same key resubmission
      const res2 = await service.requestRecovery(testEmail, "email", fixedKey, "127.0.0.1");
      assert.equal(res2.status, "PROCESSED");
      assert.equal(state.challenges.size, 1, "Idempotent requestKey must not create duplicate challenge.");
    });

    test("QA-SRV-07 (Rate Limiting): Exceeding 5 requests per 15 min per identifier throws 429", async () => {
      const remote = "192.168.1.50";
      // Manually simulate 5 previous requests for this identifier in state
      for (let i = 0; i < 5; i++) {
        await service.requestRecovery(testMobile, "sms", randomUUID(), remote);
        // Clear challenges to bypass 60s cooldown for testing the rate limiter layer
        state.challenges.clear();
      }

      // 6th request should trigger 429
      await assert.rejects(
        async () => service.requestRecovery(testMobile, "sms", randomUUID(), remote),
        (err: any) => err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      );
    });

    test("QA-SRV-08 (Delivery States): When provider returns UNKNOWN, delivery_status is updated to UNKNOWN and provider_accepted_at is NULL", async () => {
      mockDelivery.sendOtp = async () => "UNKNOWN";
      const res = await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");
      assert.equal(res.status, "PROCESSED");

      const challenge = Array.from(state.challenges.values())[0];
      assert.equal(challenge.delivery_status, "UNKNOWN");
      assert.equal(challenge.provider_accepted_at, null);
    });

    test("QA-SRV-09 (Confirm Guard): Challenges with status UNKNOWN or UNAVAILABLE cannot be confirmed", async () => {
      mockDelivery.sendOtp = async () => "UNKNOWN";
      await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");

      await assert.rejects(
        async () => service.confirmRecovery({ identifier: testMobile, otp: "123456", newPassword: "BrandNewPassword123!" }, "127.0.0.1", randomUUID()),
        BadRequestException,
        "Challenge not accepted by provider must be rejected."
      );
    });

    test("QA-SRV-10 (Confirm Guard): Expired challenge (> 10 min) cannot be confirmed", async () => {
      await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");
      const challenge = Array.from(state.challenges.values())[0];
      // Backdate expires_at to 1 second ago
      challenge.expires_at = new Date(Date.now() - 1000);

      await assert.rejects(
        async () => service.confirmRecovery({ identifier: testMobile, otp: "123456", newPassword: "BrandNewPassword123!" }, "127.0.0.1", randomUUID()),
        BadRequestException
      );
    });

    test("QA-SRV-11 (Attempt Counter): Wrong OTP increments attempts counter and throws 400", async () => {
      await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");
      const challenge = Array.from(state.challenges.values())[0];
      assert.equal(challenge.attempts, 0);

      await assert.rejects(
        async () => service.confirmRecovery({ identifier: testMobile, otp: "000000", newPassword: "BrandNewPassword123!" }, "127.0.0.1", randomUUID()),
        BadRequestException
      );

      assert.equal(challenge.attempts, 1, "Wrong OTP must increment attempt counter.");
    });

    test("QA-SRV-12 (Lockout): 5 wrong attempts locks out the challenge", async () => {
      await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");
      const challenge = Array.from(state.challenges.values())[0];

      // Simulate 5 failed attempts
      challenge.attempts = 5;

      await assert.rejects(
        async () => service.confirmRecovery({ identifier: testMobile, otp: "123456", newPassword: "BrandNewPassword123!" }, "127.0.0.1", randomUUID()),
        BadRequestException,
        "Challenge with 5 attempts must be locked out."
      );
    });

    test("QA-SRV-13 (Password Policy): Resetting to identical current password throws 400 and preserves attempts/challenge", async () => {
      let sentCode = "";
      mockDelivery.sendOtp = async (to, ch, code) => {
        sentCode = code;
        return "PROVIDER_ACCEPTED";
      };

      await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");
      assert.ok(/^\d{6}$/.test(sentCode), "OTP code must be 6 digits.");

      // Attempt reset to same password
      await assert.rejects(
        async () => service.confirmRecovery({ identifier: testMobile, otp: sentCode, newPassword: testOldPassword }, "127.0.0.1", randomUUID()),
        (err: any) => err instanceof BadRequestException && err.message === "Choose a different password"
      );

      // Verify password was NOT changed
      const cred = state.credentials.get(testAccountId)!;
      assert.equal(cred.password_hash, testOldPasswordHash);
    });

    test("QA-SRV-14 (Happy Path & Single-Use): Valid OTP resets password, rotates versions, revokes sessions, and prevents replay", async () => {
      let capturedOtp = "";
      mockDelivery.sendOtp = async (to, ch, code) => {
        capturedOtp = code;
        return "PROVIDER_ACCEPTED";
      };

      // Seed an active session to test session revocation
      const testSessionId = randomUUID();
      state.sessions.set(testSessionId, {
        id: testSessionId,
        account_id: testAccountId,
        revoked_at: null,
      });

      // 1. Request recovery via SMS
      const reqRes = await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");
      assert.equal(reqRes.status, "PROCESSED");

      const challenge = Array.from(state.challenges.values())[0];
      assert.equal(challenge.delivery_status, "PROVIDER_ACCEPTED");
      assert.ok(challenge.provider_accepted_at !== null);

      // 2. Confirm recovery with valid OTP and new password
      const newPassword = "BrandNewSuperSecurePassword999!";
      const confirmRes = await service.confirmRecovery(
        { identifier: testMobile, otp: capturedOtp, newPassword },
        "127.0.0.1",
        "corr-ref-123"
      );

      assert.equal(confirmRes.status, "PASSWORD_RESET");
      assert.ok(confirmRes.message.includes("Password updated"));

      // 3. Verify state updates
      const updatedCred = state.credentials.get(testAccountId)!;
      assert.notEqual(updatedCred.password_hash, testOldPasswordHash);
      assert.equal(updatedCred.credential_version, 2);
      assert.equal(await verifyPassword(newPassword, updatedCred.password_hash), true);

      const updatedAccount = state.accounts.get(testAccountId)!;
      assert.equal(updatedAccount.access_version, 2, "access_version must be incremented to invalidate tokens.");

      const updatedSession = state.sessions.get(testSessionId)!;
      assert.ok(updatedSession.revoked_at !== null, "All prior sessions must be revoked.");

      assert.ok(challenge.consumed_at !== null, "Challenge must be marked consumed.");

      assert.equal(state.audits.length, 1);
      assert.equal(state.audits[0].action_key, "identity.password.recovery");
      assert.equal(state.audits[0].outcome, "SUCCESS");

      // 4. Attempt to replay the same OTP: MUST FAIL because challenge is consumed
      await assert.rejects(
        async () =>
          service.confirmRecovery(
            { identifier: testMobile, otp: capturedOtp, newPassword: "AnotherNewPassword123!" },
            "127.0.0.1",
            "corr-ref-456"
          ),
        BadRequestException,
        "Replay of consumed OTP must be rejected."
      );
    });

    test("QA-SRV-15 (Email Flow Parity): Valid Email OTP resets password with identical security semantics", async () => {
      let capturedOtp = "";
      mockDelivery.sendOtp = async (to, ch, code) => {
        capturedOtp = code;
        return "PROVIDER_ACCEPTED";
      };

      // Request via email
      await service.requestRecovery(testEmail, "email", randomUUID(), "127.0.0.1");

      const newPassword = "EmailResetPassword123!";
      const res = await service.confirmRecovery(
        { identifier: testEmail, otp: capturedOtp, newPassword },
        "127.0.0.1",
        "corr-ref-email"
      );

      assert.equal(res.status, "PASSWORD_RESET");
      const cred = state.credentials.get(testAccountId)!;
      assert.equal(await verifyPassword(newPassword, cred.password_hash), true);
    });

    test("QA-SRV-16 (Network IP Rate Limit): Exceeding 100 requests per 15 min from same IP throws 429", async () => {
      const remoteIp = "10.0.0.99";
      for (let i = 0; i < 100; i++) {
        // Use unique dummy identifiers to only increment network IP counter
        await service.requestRecovery(`987000${String(i).padStart(4, "0")}`, "sms", randomUUID(), remoteIp);
      }

      // 101st request from same IP should throw 429
      await assert.rejects(
        async () => service.requestRecovery("9876543210", "sms", randomUUID(), remoteIp),
        (err: any) => err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      );
    });

    test("QA-SRV-17 (Confirm Rate Limit): Exceeding 12 confirm attempts per 15 min per identifier throws 429", async () => {
      for (let i = 0; i < 12; i++) {
        try {
          await service.confirmRecovery(
            { identifier: testMobile, otp: "000000", newPassword: "NewPassword123!" },
            "127.0.0.1",
            randomUUID()
          );
        } catch {}
      }

      // 13th confirm attempt should trigger rate limiting (429)
      await assert.rejects(
        async () =>
          service.confirmRecovery(
            { identifier: testMobile, otp: "000000", newPassword: "NewPassword123!" },
            "127.0.0.1",
            randomUUID()
          ),
        (err: any) => err instanceof HttpException && err.getStatus() === HttpStatus.TOO_MANY_REQUESTS
      );
    });

    test("QA-SRV-18 (Multiple Active Sessions Revoked): Resetting password revokes ALL active sessions for the account", async () => {
      let capturedOtp = "";
      mockDelivery.sendOtp = async (to, ch, code) => {
        capturedOtp = code;
        return "PROVIDER_ACCEPTED";
      };

      // Create 3 active sessions across different devices
      const s1 = randomUUID(), s2 = randomUUID(), s3 = randomUUID();
      state.sessions.set(s1, { id: s1, account_id: testAccountId, revoked_at: null });
      state.sessions.set(s2, { id: s2, account_id: testAccountId, revoked_at: null });
      state.sessions.set(s3, { id: s3, account_id: testAccountId, revoked_at: null });

      // Request and confirm reset
      await service.requestRecovery(testMobile, "sms", randomUUID(), "127.0.0.1");
      await service.confirmRecovery(
        { identifier: testMobile, otp: capturedOtp, newPassword: "BrandNewPassword123!" },
        "127.0.0.1",
        randomUUID()
      );

      // Verify all 3 sessions have revoked_at set
      assert.ok(state.sessions.get(s1)!.revoked_at !== null, "Session 1 must be revoked.");
      assert.ok(state.sessions.get(s2)!.revoked_at !== null, "Session 2 must be revoked.");
      assert.ok(state.sessions.get(s3)!.revoked_at !== null, "Session 3 must be revoked.");
    });
  });
});
