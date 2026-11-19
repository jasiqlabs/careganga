/**
 * CareGanga Foundation — Web Authentication Error Mapper
 *
 * Central authority for mapping backend and client authentication errors
 * to clear, human-readable, production-safe messages.
 *
 * Adheres strictly to the CareGanga real-api-truthfulness and safe-error guidelines:
 * - Accurately distinguishes account-state errors from connection failures.
 * - Prioritizes suspended-account identification and extracts validated suspension reasons.
 * - Never leaks raw database errors, stack traces, internal identifiers, or credentials.
 * - Avoids false network error claims when the server responded with an error status.
 */

export interface AuthErrorPayload {
  code?: string | null;
  message?: string | null;
  reason?: string | null;
  suspensionReason?: string | null;
  field?: string | null;
  details?: { reason?: string | null } | null;
  status?: string | number | null;
  statusCode?: number | null;
}

export interface MappedAuthError {
  /** The human-readable message for user display */
  message: string;
  /** Notification alert title for toast display */
  notificationTitle: string;
  /** Notification type */
  notificationType: "ERROR" | "WARNING" | "INFO";
  /** Field-specific error target if applicable */
  field?: "identifier" | "password" | null;
  /** Normalized category */
  category:
    | "ACCOUNT_SUSPENDED"
    | "ACCOUNT_DISABLED"
    | "ACCOUNT_LOCKED"
    | "INVALID_CREDENTIALS"
    | "ACCOUNT_NOT_FOUND"
    | "VALIDATION_ERROR"
    | "TOO_MANY_ATTEMPTS"
    | "NETWORK_UNAVAILABLE"
    | "REQUEST_TIMEOUT"
    | "SERVER_UNAVAILABLE"
    | "UNKNOWN_ERROR";
}

/**
 * Safely extracts and sanitizes a suspension reason from backend payloads.
 * Prevents markup injection, technical stack traces, or SQL leaks.
 */
function extractSanitizedReason(payload: AuthErrorPayload): string | null {
  const raw =
    (typeof payload.reason === "string" && payload.reason) ||
    (typeof payload.suspensionReason === "string" && payload.suspensionReason) ||
    (payload.details && typeof payload.details.reason === "string" && payload.details.reason) ||
    null;

  if (!raw) return null;

  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Never display raw technical exceptions, SQL, stack traces, or technical IDs
  if (
    /error:|exception|at\s+[a-z0-9_.]+|select\s+|insert\s+|update\s+|delete\s+|nullpointer|[<>{}]|p0\d{3}/i.test(
      trimmed
    )
  ) {
    return null;
  }

  // Strip any accidental HTML/XML tags
  const sanitized = trimmed.replace(/<[^>]*>/g, "").trim();
  if (sanitized.length === 0) return null;

  // Bound length to avoid UI distortion (max 180 chars)
  return sanitized.length > 180 ? sanitized.slice(0, 177) + "…" : sanitized;
}

/**
 * Maps HTTP response statuses and backend error payloads to accurate human-readable errors.
 */
export function mapAuthError(
  status: number,
  payload?: AuthErrorPayload | null
): MappedAuthError {
  const code = typeof payload?.code === "string" ? payload.code.trim().toUpperCase() : "";
  const reason = payload ? extractSanitizedReason(payload) : null;

  // 1. Suspended Account Check (Highest Priority)
  const isSuspendedCode =
    code === "ACCOUNT_SUSPENDED" ||
    code === "IDENTITY_ACCOUNT_SUSPENDED" ||
    code === "SUSPENDED" ||
    code === "ACCOUNT_IN_STATUS_SUSPENDED" ||
    code.includes("SUSPEND");

  const messageIndicatesSuspended =
    typeof payload?.message === "string" &&
    /suspend/i.test(payload.message) &&
    !/cannot be confirmed|connection/i.test(payload.message);

  if (isSuspendedCode || (status === 403 && (reason || messageIndicatesSuspended))) {
    return {
      category: "ACCOUNT_SUSPENDED",
      notificationTitle: "Account Suspended",
      notificationType: "ERROR",
      message: reason
        ? `Your account has been suspended. Reason: ${reason}. Please contact your administrator for assistance.`
        : "Your account is currently suspended. Please contact your administrator for assistance."
    };
  }

  // 2. Disabled / Inactive Account Check
  const isDisabledCode =
    code === "ACCOUNT_DISABLED" ||
    code === "IDENTITY_ACCOUNT_DISABLED" ||
    code === "DEACTIVATED" ||
    code === "ACCOUNT_DEACTIVATED" ||
    code === "DISABLED";

  const messageIndicatesDisabled =
    typeof payload?.message === "string" &&
    /inactive|deactivated|disabled/i.test(payload.message);

  if (isDisabledCode || ((status === 403 || status === 401) && messageIndicatesDisabled)) {
    return {
      category: "ACCOUNT_DISABLED",
      notificationTitle: "Account Inactive",
      notificationType: "ERROR",
      message: "Your account is currently inactive. Please contact your administrator for help."
    };
  }

  // 3. Locked Account Check
  const isLockedCode =
    code === "ACCOUNT_LOCKED" ||
    code === "IDENTITY_ACCOUNT_LOCKED" ||
    code === "LOCKED";

  const messageIndicatesLocked =
    typeof payload?.message === "string" && /locked/i.test(payload.message);

  if (isLockedCode || status === 423 || ((status === 403 || status === 401) && messageIndicatesLocked)) {
    return {
      category: "ACCOUNT_LOCKED",
      notificationTitle: "Account Locked",
      notificationType: "ERROR",
      message: "Your account is temporarily locked. Please contact your administrator for assistance."
    };
  }

  // 4. Other 403 Forbidden
  // In the CareGanga system, a 403 Forbidden on the login endpoint indicates an account-level
  // access restriction. Map safely without claiming a connection error.
  if (status === 403) {
    return {
      category: "ACCOUNT_SUSPENDED",
      notificationTitle: "Account Suspended",
      notificationType: "ERROR",
      message: reason
        ? `Your account has been suspended. Reason: ${reason}. Please contact your administrator for assistance.`
        : "Your account is currently suspended. Please contact your administrator for assistance."
    };
  }

  // 5. Validation Errors (Status 400)
  if (status === 400) {
    const field =
      payload?.field === "identifier" || payload?.field === "password"
        ? (payload.field as "identifier" | "password")
        : null;

    if (code === "IDENTITY_IDENTIFIER_REQUIRED") {
      return {
        category: "VALIDATION_ERROR",
        field: "identifier",
        notificationTitle: "Validation Error",
        notificationType: "ERROR",
        message: "Enter your registered mobile number or email address."
      };
    }

    if (code === "IDENTITY_IDENTIFIER_INVALID") {
      return {
        category: "VALIDATION_ERROR",
        field: "identifier",
        notificationTitle: "Validation Error",
        notificationType: "ERROR",
        message: "Enter a valid 10-digit Indian mobile number starting with 6–9, or a valid email address."
      };
    }

    if (code === "IDENTITY_PASSWORD_REQUIRED") {
      return {
        category: "VALIDATION_ERROR",
        field: "password",
        notificationTitle: "Validation Error",
        notificationType: "ERROR",
        message: "Enter your password to sign in."
      };
    }

    if (code === "IDENTITY_PASSWORD_TOO_LONG") {
      return {
        category: "VALIDATION_ERROR",
        field: "password",
        notificationTitle: "Validation Error",
        notificationType: "ERROR",
        message: "The password is too long. Check your entry and try again."
      };
    }

    if (code === "IDENTITY_DEVICE_INVALID") {
      return {
        category: "VALIDATION_ERROR",
        notificationTitle: "Validation Error",
        notificationType: "ERROR",
        message: "The device details could not be accepted. Restart the sign-in form and try again."
      };
    }

    // Generic 400 with safe custom message
    const hasSafeMessage =
      typeof payload?.message === "string" &&
      payload.message.length >= 10 &&
      payload.message.length <= 220 &&
      !/[<>]/.test(payload.message);

    return {
      category: "VALIDATION_ERROR",
      field,
      notificationTitle: "Validation Error",
      notificationType: "ERROR",
      message: hasSafeMessage
        ? (payload.message as string)
        : "Check the mobile number/email and password fields before signing in."
    };
  }

  // 6. Invalid Password specifically
  if (code === "INVALID_PASSWORD" || code === "IDENTITY_INVALID_PASSWORD") {
    return {
      category: "INVALID_CREDENTIALS",
      field: "password",
      notificationTitle: "Sign-In Failed",
      notificationType: "ERROR",
      message: "The password you entered is incorrect. Please try again."
    };
  }

  // 7. Account Not Found specifically
  if (code === "ACCOUNT_NOT_FOUND" || code === "IDENTITY_ACCOUNT_NOT_FOUND") {
    return {
      category: "ACCOUNT_NOT_FOUND",
      field: "identifier",
      notificationTitle: "Account Not Found",
      notificationType: "ERROR",
      message: "We couldn't find an account with these details. Please check your mobile number or email."
    };
  }

  // 8. General 401 Unauthorized / Invalid Credentials
  if (status === 401 || code === "IDENTITY_LOGIN_INVALID" || code === "INVALID_CREDENTIALS") {
    // If backend provided a server-owned, safe message from platform error copy catalog
    const isSafeServerMessage =
      code === "IDENTITY_LOGIN_INVALID" &&
      typeof payload?.message === "string" &&
      payload.message.length >= 16 &&
      payload.message.length <= 220 &&
      !/[<>]/.test(payload.message);

    return {
      category: "INVALID_CREDENTIALS",
      notificationTitle: "Sign-In Failed",
      notificationType: "ERROR",
      message: isSafeServerMessage
        ? (payload.message as string)
        : "Mobile number, email or password could not be confirmed. Check your details and try again."
    };
  }

  // 9. Too Many Attempts (Status 429)
  if (status === 429 || code === "TOO_MANY_ATTEMPTS") {
    return {
      category: "TOO_MANY_ATTEMPTS",
      notificationTitle: "Too Many Attempts",
      notificationType: "ERROR",
      message: "Too many sign-in attempts. Please wait a while before trying again."
    };
  }

  // 10. Request Timeout (Status 408 / 504)
  if (status === 408 || status === 504 || code === "REQUEST_TIMEOUT") {
    return {
      category: "REQUEST_TIMEOUT",
      notificationTitle: "Request Timeout",
      notificationType: "ERROR",
      message: "The request took too long. Please try again."
    };
  }

  // 11. Server Unavailable (Status 500, 502, 503)
  if (status === 500 || status === 502 || status === 503 || code === "SERVER_UNAVAILABLE") {
    return {
      category: "SERVER_UNAVAILABLE",
      notificationTitle: "Service Unavailable",
      notificationType: "ERROR",
      message: "We're having trouble signing you in right now. Please try again shortly."
    };
  }

  // 12. Safe Fallback for Unknown Error
  return {
    category: "UNKNOWN_ERROR",
    notificationTitle: "Sign-In Failed",
    notificationType: "ERROR",
    message: "We couldn't sign you in right now. Please try again. If the problem continues, contact your administrator."
  };
}

/**
 * Maps client-side exceptions (browser offline, aborts, timeouts, network drops)
 * to accurate, human-readable errors.
 */
export function mapAuthClientError(error: unknown): MappedAuthError {
  // Check if browser is offline
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return {
      category: "NETWORK_UNAVAILABLE",
      notificationTitle: "Connection Error",
      notificationType: "ERROR",
      message: "We couldn't connect right now. Please check your internet connection and try again."
    };
  }

  // Check for timeout / abort
  if (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      /timeout|timed\s*out|aborted/i.test(error.message))
  ) {
    return {
      category: "REQUEST_TIMEOUT",
      notificationTitle: "Request Timeout",
      notificationType: "ERROR",
      message: "The request took too long. Please try again."
    };
  }

  // Check for genuine network errors (e.g. Failed to fetch, NetworkError)
  if (
    error instanceof TypeError ||
    (error instanceof Error &&
      /failed to fetch|network\s*error|networkrequestfailed|load failed/i.test(
        error.message
      ))
  ) {
    return {
      category: "NETWORK_UNAVAILABLE",
      notificationTitle: "Connection Error",
      notificationType: "ERROR",
      message: "We couldn't connect right now. Please check your internet connection and try again."
    };
  }

  // Safe fallback for other unexpected client-side errors
  return {
    category: "UNKNOWN_ERROR",
    notificationTitle: "Sign-In Failed",
    notificationType: "ERROR",
    message: "We couldn't sign you in right now. Please try again. If the problem continues, contact your administrator."
  };
}
