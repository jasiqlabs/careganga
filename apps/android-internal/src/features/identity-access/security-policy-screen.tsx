import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  AppState,
  BackHandler,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Crypto from "expo-crypto";
import type { CG01SessionView } from "@careganga/api-contracts";
import { identityRequest } from "./http-client";
import { AccessDeniedScreen } from "./access-denied-screen";
import { AuthenticatedAppShell } from "../dashboard/authenticated-app-shell";
import type { ModuleActionHandlers } from "../dashboard/dashboard-modules";
import { IconLock, IconUsers } from "../dashboard/dashboard-icons";
import { IconArrowLeft, IconEye, IconEyeOff } from "./auth-icons";
import { AuthToast, useAuthToast } from "./auth-toast";

type Policy = {
  maxSessionAgeSeconds: number;
  idleTimeoutSeconds: number;
  failedAttemptWindowSeconds: number;
  maxFailedAttempts: number;
  rootPasswordReauthRequired: true;
  revision: number;
  updatedAt: string | null;
};

type Form = {
  maximum: string;
  idle: string;
  window: string;
  attempts: string;
};

const fields: {
  key: keyof Form;
  name: string;
  hint: string;
  rangeText: string;
  unit: string;
  min: number;
  max: number;
}[] = [
  {
    key: "maximum",
    name: "Maximum session age",
    hint: "Minutes · 15–480",
    rangeText: "15 minutes to 8 hours",
    unit: "minutes",
    min: 15,
    max: 480
  },
  {
    key: "idle",
    name: "Idle session timeout",
    hint: "Minutes · 5–60",
    rangeText: "5 to 60 minutes",
    unit: "minutes",
    min: 5,
    max: 60
  },
  {
    key: "window",
    name: "Failed-attempt window",
    hint: "Minutes · 5–60",
    rangeText: "5 to 60 minutes",
    unit: "minutes",
    min: 5,
    max: 60
  },
  {
    key: "attempts",
    name: "Allowed failed attempts",
    hint: "Attempts · 3–10",
    rangeText: "3 to 10 attempts",
    unit: "attempts",
    min: 3,
    max: 10
  }
];

function form(p: Policy): Form {
  return {
    maximum: String(p.maxSessionAgeSeconds / 60),
    idle: String(p.idleTimeoutSeconds / 60),
    window: String(p.failedAttemptWindowSeconds / 60),
    attempts: String(p.maxFailedAttempts)
  };
}

function validPolicy(x: unknown): x is Policy {
  if (!x || typeof x !== "object" || Array.isArray(x)) return false;
  const p = x as Record<string, unknown>;
  const max = p.maxSessionAgeSeconds,
    idle = p.idleTimeoutSeconds;
  const window = p.failedAttemptWindowSeconds,
    attempts = p.maxFailedAttempts;
  return (
    p.rootPasswordReauthRequired === true &&
    Number.isSafeInteger(p.revision) &&
    Number(p.revision) >= 0 &&
    typeof max === "number" &&
    Number.isInteger(max) &&
    max >= 900 &&
    max <= 28800 &&
    max % 60 === 0 &&
    typeof idle === "number" &&
    Number.isInteger(idle) &&
    idle >= 300 &&
    idle <= 3600 &&
    idle % 60 === 0 &&
    idle <= max &&
    typeof window === "number" &&
    Number.isInteger(window) &&
    window >= 300 &&
    window <= 3600 &&
    window % 60 === 0 &&
    typeof attempts === "number" &&
    Number.isInteger(attempts) &&
    attempts >= 3 &&
    attempts <= 10 &&
    (p.updatedAt === null || typeof p.updatedAt === "string")
  );
}

// -------------------------------------------------------------
// Consistent Outline Vector Icons with 2px stroke weight
// -------------------------------------------------------------

function IconClock({ size = 22, color = "#059669" }: { size?: number; color?: string }) {
  const r = Math.round(size * 0.44);
  return (
    <View style={[styles.vectorBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: r * 2,
          height: r * 2,
          borderRadius: r,
          borderWidth: 2,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ position: "absolute", top: r * 0.35, width: 2, height: r * 0.65, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ position: "absolute", left: r - 1, width: r * 0.55, height: 2, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

function IconHourglass({ size = 22, color = "#059669" }: { size?: number; color?: string }) {
  const w = Math.round(size * 0.68);
  const h = Math.round(size * 0.82);
  return (
    <View style={[styles.vectorBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: w, height: 2, backgroundColor: color, borderRadius: 1 }} />
      <View style={{ width: w, height: h - 4, justifyContent: "space-between", alignItems: "center" }}>
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: (w - 2) / 2,
            borderRightWidth: (w - 2) / 2,
            borderTopWidth: (h - 6) / 2,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderTopColor: color,
            opacity: 0.95
          }}
        />
        <View
          style={{
            width: 0,
            height: 0,
            borderLeftWidth: (w - 2) / 2,
            borderRightWidth: (w - 2) / 2,
            borderBottomWidth: (h - 6) / 2,
            borderLeftColor: "transparent",
            borderRightColor: "transparent",
            borderBottomColor: color,
            opacity: 0.95
          }}
        />
      </View>
      <View style={{ width: w, height: 2, backgroundColor: color, borderRadius: 1 }} />
    </View>
  );
}

function IconAlertShield({ size = 22, color = "#059669" }: { size?: number; color?: string }) {
  const w = Math.round(size * 0.76);
  const h = Math.round(size * 0.86);
  return (
    <View style={[styles.vectorBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: w,
          height: h,
          borderTopLeftRadius: w / 2,
          borderTopRightRadius: w / 2,
          borderBottomLeftRadius: w / 2,
          borderBottomRightRadius: w / 2,
          borderWidth: 2,
          borderColor: color,
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <View style={{ width: 2, height: 6, backgroundColor: color, borderRadius: 1, marginBottom: 2 }} />
        <View style={{ width: 2, height: 2, backgroundColor: color, borderRadius: 1 }} />
      </View>
    </View>
  );
}

function IconCalendar({ size = 16, color = "#0F172A" }: { size?: number; color?: string }) {
  const w = Math.round(size * 0.88);
  const h = Math.round(size * 0.82);
  return (
    <View style={[styles.vectorBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View style={{ width: w, flexDirection: "row", justifyContent: "space-around", marginBottom: -1.5, zIndex: 2 }}>
        <View style={{ width: 2, height: 3.5, backgroundColor: color, borderRadius: 1 }} />
        <View style={{ width: 2, height: 3.5, backgroundColor: color, borderRadius: 1 }} />
      </View>
      <View
        style={{
          width: w,
          height: h - 2,
          borderRadius: 3.5,
          borderWidth: 1.8,
          borderColor: color,
          overflow: "hidden"
        }}
      >
        <View style={{ width: "100%", height: 3, backgroundColor: color }} />
        <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-around", alignItems: "center", padding: 1.5 }}>
          <View style={{ width: 1.5, height: 1.5, borderRadius: 0.75, backgroundColor: color }} />
          <View style={{ width: 1.5, height: 1.5, borderRadius: 0.75, backgroundColor: color }} />
          <View style={{ width: 1.5, height: 1.5, borderRadius: 0.75, backgroundColor: color }} />
          <View style={{ width: 1.5, height: 1.5, borderRadius: 0.75, backgroundColor: color }} />
        </View>
      </View>
    </View>
  );
}

function IconRefresh({ size = 16, color = "#0F172A" }: { size?: number; color?: string }) {
  const d = Math.round(size * 0.8);
  return (
    <View style={[styles.vectorBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: d,
          height: d,
          borderRadius: d / 2,
          borderWidth: 2,
          borderColor: color,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          transform: [{ rotate: "45deg" }]
        }}
      />
      <View
        style={{
          position: "absolute",
          top: 0,
          right: 1,
          width: 0,
          height: 0,
          borderLeftWidth: 3,
          borderRightWidth: 3,
          borderBottomWidth: 4.5,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderBottomColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 0,
          left: 1,
          width: 0,
          height: 0,
          borderLeftWidth: 3,
          borderRightWidth: 3,
          borderTopWidth: 4.5,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

function IconEdit({ size = 16, color = "#FFFFFF" }: { size?: number; color?: string }) {
  const len = Math.round(size * 0.7);
  return (
    <View style={[styles.vectorBox, { width: size, height: size }]} accessibilityElementsHidden importantForAccessibility="no">
      <View
        style={{
          width: 3.5,
          height: len,
          borderWidth: 1.6,
          borderColor: color,
          borderRadius: 1,
          transform: [{ rotate: "-45deg" }]
        }}
      />
      <View
        style={{
          position: "absolute",
          bottom: 1,
          left: 1,
          width: 0,
          height: 0,
          borderLeftWidth: 2,
          borderRightWidth: 2,
          borderTopWidth: 4,
          borderLeftColor: "transparent",
          borderRightColor: "transparent",
          borderTopColor: color,
          transform: [{ rotate: "45deg" }]
        }}
      />
    </View>
  );
}

// -------------------------------------------------------------
// Component Props
// -------------------------------------------------------------

export interface SecurityPolicyScreenProps {
  token: string;
  actor?: CG01SessionView | null;
  roleActions?: string[];
  handlers?: ModuleActionHandlers;
  onSignOut?: () => void;
  onExit: () => void;
  onExpired: () => void;
}

export function SecurityPolicyScreen({
  token,
  actor,
  roleActions = [],
  handlers,
  onSignOut,
  onExit,
  onExpired
}: SecurityPolicyScreenProps) {
  const [current, setCurrent] = useState<Policy | null>(null);
  const [values, setValues] = useState<Form | null>(null);
  const [editing, setEditing] = useState(false);
  const [review, setReview] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingOutcome, setCheckingOutcome] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [denied, setDenied] = useState(false);
  const [message, setMessage] = useState("");
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const requestKey = useRef("");
  const generation = useRef(0);
  const saving = useRef(false);
  const formScrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Animations
  const shimmerAnim = useRef(new Animated.Value(0.4)).current;
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const contentSlideAnim = useRef(new Animated.Value(12)).current;

  // Reusable Toast Feedback
  const { toast, showToast, hideToast } = useAuthToast();

  // Subtle Shimmer animation for skeleton cards
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (loading && !current) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(shimmerAnim, {
            toValue: 0.9,
            duration: 800,
            useNativeDriver: true
          }),
          Animated.timing(shimmerAnim, {
            toValue: 0.4,
            duration: 800,
            useNativeDriver: true
          })
        ])
      );
      anim.start();
    }
    return () => {
      if (anim) anim.stop();
    };
  }, [loading, current, shimmerAnim]);

  // Entrance animation for content when data loads
  const triggerEntranceAnimation = useCallback(() => {
    contentFadeAnim.setValue(0);
    contentSlideAnim.setValue(12);
    Animated.parallel([
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 320,
        useNativeDriver: true
      }),
      Animated.timing(contentSlideAnim, {
        toValue: 0,
        duration: 320,
        useNativeDriver: true
      })
    ]).start();
  }, [contentFadeAnim, contentSlideAnim]);

  // Keyboard height listener on Android/iOS
  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      e => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const read = useCallback(
    async (expectedRevision?: number): Promise<boolean> => {
      const seq = ++generation.current;
      setLoading(true);
      try {
        const result = await identityRequest("/api/identity/security-policy", {
          headers: { Authorization: "Bearer " + token }
        });
        if (result.status === 401) {
          if (seq === generation.current) onExpired();
          return false;
        }
        if (result.status === 403) {
          if (seq === generation.current) {
            setCurrent(null);
            setDenied(true);
          }
          return false;
        }
        if (!result.ok) throw Error("Current security policy unavailable");
        const payload: unknown = await result.json();
        if (!validPolicy(payload)) throw Error("Policy response could not be verified");
        if (seq !== generation.current) return false;
        const matched = expectedRevision === undefined || payload.revision >= expectedRevision;
        setCurrent(payload);
        setValues(form(payload));
        setEditing(false);
        setReview(false);
        setCurrentPassword("");
        triggerEntranceAnimation();

        if (matched) {
          setUnknown(false);
          setMessage("");
          requestKey.current = "";
        } else {
          setUnknown(true);
          setMessage("The saved revision is not visible yet. Check the previous change before retrying.");
        }
        return matched;
      } catch {
        if (seq !== generation.current) return false;
        setCurrent(null);
        setValues(null);
        setEditing(false);
        setMessage("Protected policy could not be verified. Check your connection.");
        return false;
      } finally {
        if (seq === generation.current) setLoading(false);
      }
    },
    [token, onExpired, triggerEntranceAnimation]
  );

  useEffect(() => {
    void read();
    return () => {
      ++generation.current;
    };
  }, [read]);

  // Handle manual Refresh button and Pull-to-refresh
  const handleRefresh = useCallback(async () => {
    if (refreshing || busy) return;
    setRefreshing(true);
    try {
      await read();
    } finally {
      setRefreshing(false);
    }
  }, [read, refreshing, busy]);

  useEffect(() => {
    const back = BackHandler.addEventListener("hardwareBackPress", () => {
      if (saving.current) return true;
      if (editing) {
        setEditing(false);
        setReview(false);
        setCurrentPassword("");
        return true;
      }
      onExit();
      return true;
    });
    return () => back.remove();
  }, [editing, onExit]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", state => {
      if (state === "active" && !editing && !unknown) void read();
      else if (state !== "active") {
        setCurrent(null);
        setValues(null);
        setEditing(false);
        setReview(false);
        setCurrentPassword("");
      }
    });
    return () => sub.remove();
  }, [read, editing, unknown]);

  async function checkOutcome() {
    if (!unknown || !requestKey.current || checkingOutcome) return;
    setCheckingOutcome(true);
    try {
      const result = await identityRequest(
        "/api/identity/security-policy/changes/" + encodeURIComponent(requestKey.current),
        {
          headers: { Authorization: "Bearer " + token }
        }
      );
      if (result.status === 401) {
        onExpired();
        return;
      }
      if (result.status === 403) {
        setCurrent(null);
        onExit();
        return;
      }
      if (!result.ok) throw Error("Unavailable");
      const body = (await result.json()) as { status?: string; revision?: number | null };
      if (body.status === "CONFIRMED" && Number.isInteger(body.revision)) {
        const verified = await read(Number(body.revision));
        setUnknown(!verified);
        if (verified) {
          showToast({
            type: "success",
            title: "Change Confirmed",
            message: "The earlier change is confirmed and the effective policy reloaded."
          });
        } else {
          showToast({
            type: "warning",
            title: "Verification Pending",
            message: "The change was recorded, but its effective policy cannot yet be confirmed."
          });
        }
      } else {
        showToast({
          type: "info",
          title: "No Outcome Visible",
          message: "No committed outcome is visible yet. Check again before retrying."
        });
      }
    } catch {
      showToast({
        type: "error",
        title: "Connection Failed",
        message: "The previous change cannot yet be confirmed. Check again before trying another edit."
      });
    } finally {
      setCheckingOutcome(false);
    }
  }

  function begin() {
    if (!current) return;
    requestKey.current = Crypto.randomUUID();
    setValues(form(current));
    setEditing(true);
    setReview(false);
    setCurrentPassword("");
    setShowPassword(false);
    setUnknown(false);
    setMessage("");
  }

  function change(key: keyof Form, text: string) {
    setValues(old => (old ? { ...old, [key]: text.replace(/[^0-9]/g, "") } : old));
    setReview(false);
  }

  function validate(v: Form): boolean {
    if (
      !fields.every(
        f =>
          v[f.key].length > 0 &&
          Number.isInteger(Number(v[f.key])) &&
          Number(v[f.key]) >= f.min &&
          Number(v[f.key]) <= f.max
      )
    )
      return false;
    return Number(v.idle) <= Number(v.maximum);
  }

  async function save() {
    if (!values || !current || busy || unknown) return;
    if (!validate(values)) {
      showToast({
        type: "error",
        title: "Invalid Limits",
        message: "Check permitted limits. Idle timeout cannot exceed maximum session age."
      });
      return;
    }
    if (!review) {
      setReview(true);
      return;
    }
    if (currentPassword.length < 8 || currentPassword.length > 1024) {
      showToast({
        type: "error",
        title: "Password Required",
        message: "Please enter your current Super Admin password (minimum 8 characters)."
      });
      return;
    }
    saving.current = true;
    setBusy(true);
    const body = {
      maxSessionAgeSeconds: Number(values.maximum) * 60,
      idleTimeoutSeconds: Number(values.idle) * 60,
      failedAttemptWindowSeconds: Number(values.window) * 60,
      maxFailedAttempts: Number(values.attempts),
      rootPasswordReauthRequired: true,
      expectedRevision: current.revision,
      idempotencyKey: requestKey.current,
      currentPassword
    };
    try {
      const result = await identityRequest("/api/identity/security-policy", {
        method: "PATCH",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });
      if (result.status === 401) {
        setCurrent(null);
        onExpired();
        return;
      }
      if (result.status === 403) {
        setCurrent(null);
        setEditing(false);
        showToast({
          type: "error",
          title: "Access Denied",
          message: "Your Super Admin access could not be verified."
        });
        return;
      }
      if (result.status === 409) {
        setReview(false);
        showToast({
          type: "warning",
          title: "Policy Changed Elsewhere",
          message: "The policy changed elsewhere. Keep these values and refresh before saving."
        });
        return;
      }
      if (result.status === 429) {
        setReview(false);
        showToast({
          type: "error",
          title: "Rate Limited",
          message: "Too many password confirmation attempts. Try again later."
        });
        return;
      }
      if (!result.ok) {
        if (result.status >= 500) {
          setUnknown(true);
          showToast({
            type: "warning",
            title: "Update Unconfirmed",
            message: "The change may be saved. Refresh the effective policy before attempting another change."
          });
        } else {
          setReview(false);
          showToast({
            type: "error",
            title: "Update Failed",
            message: "Policy was not accepted. Review limits and enter your correct current password."
          });
        }
        return;
      }
      const ack: unknown = await result.json();
      if (!ack || typeof ack !== "object" || !("revision" in ack) || !Number.isInteger(ack.revision))
        throw Error("Unconfirmed");
      const verified = await read(Number(ack.revision));
      if (!verified) setUnknown(true);

      showToast({
        type: "success",
        title: "Security Policy Updated",
        message: "Security policy has been successfully updated and verified."
      });
    } catch {
      setUnknown(true);
      showToast({
        type: "error",
        title: "Update Failed",
        message: "The security policy could not be updated. Please try again."
      });
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  if (denied) {
    return (
      <AccessDeniedScreen
        reason="Security Policy is restricted to the Foundation Super Admin."
        onMyAccount={onExit}
      />
    );
  }

  // -------------------------------------------------------------
  // VIEW MODE: Matching the attached CareGanga UI reference
  // -------------------------------------------------------------
  const renderViewContent = () => {
    const lastUpdatedFormatted = current?.updatedAt
      ? new Date(current.updatedAt).toLocaleString()
      : "Secure Foundation defaults";

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            colors={["#059669", "#10B981"]}
            tintColor="#059669"
            progressBackgroundColor="#FFFFFF"
          />
        }
      >
        {/* Page Introduction */}
        <View style={styles.introRow}>
          <View style={styles.introIconBox}>
            <IconLock size={24} color="#059669" />
          </View>
          <View style={styles.introTextBox}>
            <Text accessibilityRole="header" style={styles.pageTitle}>
              Security Policy
            </Text>
            <Text style={styles.pageDescription}>
              Authentication and session security settings{"\n"}for the foundation platform.
            </Text>
          </View>
        </View>

        {/* Action Buttons Row: Refresh & Edit Policy */}
        <View style={styles.actionsRow}>
          {/* Refresh Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Refresh security policy"
            disabled={busy || loading || refreshing || unknown}
            onPress={() => void handleRefresh()}
            style={({ pressed }) => [
              styles.actionButton,
              styles.refreshButton,
              pressed && styles.buttonPressed,
              (busy || loading || refreshing || unknown) && styles.buttonDisabled
            ]}
          >
            {refreshing ? (
              <ActivityIndicator size="small" color="#0F172A" />
            ) : (
              <IconRefresh size={16} color="#0F172A" />
            )}
            <Text style={styles.refreshButtonText}>
              {refreshing ? "Refreshing…" : "Refresh"}
            </Text>
          </Pressable>

          {/* Edit Policy Button */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Edit security policy"
            disabled={busy || loading || refreshing || !current || unknown}
            onPress={begin}
            style={({ pressed }) => [
              styles.actionButton,
              styles.editButton,
              pressed && styles.buttonPressed,
              (busy || loading || refreshing || !current || unknown) && styles.buttonDisabled
            ]}
          >
            <IconEdit size={16} color="#FFFFFF" />
            <Text style={styles.editButtonText}>Edit Policy</Text>
          </Pressable>
        </View>

        {/* Skeleton Shimmer Loading when initial data is loading */}
        {loading && !current && (
          <Animated.View style={[styles.cardsContainer, { opacity: shimmerAnim }]}>
            {[1, 2, 3, 4, 5].map(idx => (
              <View key={idx} style={styles.configCard}>
                <View style={styles.skeletonIconBox} />
                <View style={styles.cardContentBox}>
                  <View style={styles.skeletonTitle} />
                  <View style={styles.skeletonValue} />
                  <View style={styles.skeletonRange} />
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        {/* Five Configuration Cards with smooth entrance */}
        {current && (
          <Animated.View
            style={[
              styles.cardsContainer,
              {
                opacity: contentFadeAnim,
                transform: [{ translateY: contentSlideAnim }]
              }
            ]}
          >
            {/* Card 1 — Maximum Session Age */}
            <View style={styles.configCard}>
              <View style={styles.cardIconBox}>
                <IconClock size={22} color="#059669" />
              </View>
              <View style={styles.cardContentBox}>
                <Text style={styles.cardTitle}>{fields[0].name}</Text>
                <Text style={styles.cardValue}>{form(current).maximum} minutes</Text>
                <Text style={styles.cardRange}>{fields[0].rangeText}</Text>
              </View>
            </View>

            {/* Card 2 — Idle Session Timeout */}
            <View style={styles.configCard}>
              <View style={styles.cardIconBox}>
                <IconHourglass size={22} color="#059669" />
              </View>
              <View style={styles.cardContentBox}>
                <Text style={styles.cardTitle}>{fields[1].name}</Text>
                <Text style={styles.cardValue}>{form(current).idle} minutes</Text>
                <Text style={styles.cardRange}>{fields[1].rangeText}</Text>
              </View>
            </View>

            {/* Card 3 — Failed-Attempt Window */}
            <View style={styles.configCard}>
              <View style={styles.cardIconBox}>
                <IconAlertShield size={22} color="#059669" />
              </View>
              <View style={styles.cardContentBox}>
                <Text style={styles.cardTitle}>{fields[2].name}</Text>
                <Text style={styles.cardValue}>{form(current).window} minutes</Text>
                <Text style={styles.cardRange}>{fields[2].rangeText}</Text>
              </View>
            </View>

            {/* Card 4 — Allowed Failed Attempts */}
            <View style={styles.configCard}>
              <View style={styles.cardIconBox}>
                <IconUsers size={22} color="#059669" />
              </View>
              <View style={styles.cardContentBox}>
                <Text style={styles.cardTitle}>{fields[3].name}</Text>
                <Text style={styles.cardValue}>{form(current).attempts} attempts</Text>
                <Text style={styles.cardRange}>{fields[3].rangeText}</Text>
              </View>
            </View>

            {/* Card 5 — Super Admin Password Confirmation */}
            <View style={styles.configCard}>
              <View style={styles.cardIconBox}>
                <IconLock size={22} color="#059669" />
              </View>
              <View style={styles.cardContentBox}>
                <Text style={styles.cardTitle}>Super Admin password confirmation</Text>
                <View style={styles.requiredPill}>
                  <Text style={styles.requiredPillText}>Required</Text>
                </View>
                <Text style={styles.cardRange}>Cannot be turned off.</Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Last Updated Section */}
        {current && (
          <View style={styles.lastUpdatedContainer}>
            <IconCalendar size={16} color="#0F172A" />
            <Text style={styles.lastUpdatedText}>Last updated: {lastUpdatedFormatted}</Text>
          </View>
        )}

        {/* Unconfirmed Change Recovery Workflow */}
        {unknown && (
          <View style={styles.recoveryCard}>
            <Text style={styles.recoveryHint}>
              Do not repeat an unconfirmed change before checking its status.
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Check previous change status"
              disabled={checkingOutcome}
              style={styles.recoveryButton}
              onPress={() => void checkOutcome()}
            >
              <Text style={styles.recoveryButtonText}>
                {checkingOutcome ? "Checking status…" : "Check previous change"}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    );
  };

  // -------------------------------------------------------------
  // EDIT FORM SCREEN: Dedicated Android Form Screen with Keyboard Visibility Fix
  // -------------------------------------------------------------
  if (editing && values) {
    const isValuesValid = validate(values);
    const canSubmit = !busy && !unknown && currentPassword.length >= 8 && isValuesValid;

    return (
      <SafeAreaView style={styles.editRoot}>
        {/* Reusable Toast Notification Component */}
        <AuthToast toast={toast} onDismiss={hideToast} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.editRoot}
        >
          {/* Dedicated Android Form Header */}
          <View style={styles.formHeader}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel edit and return to policy view"
              onPress={() => {
                setEditing(false);
                setReview(false);
                setCurrentPassword("");
              }}
              style={styles.formBackButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconArrowLeft size={20} color="#0F172A" />
              <Text style={styles.formBackText}>Back</Text>
            </Pressable>
            <View style={styles.formHeaderTitleWrap}>
              <Text accessibilityRole="header" style={styles.formTitle}>
                Edit Security Policy
              </Text>
              <Text style={styles.formSubtitle}>
                Update session limits, timeouts, and failed attempt thresholds.
              </Text>
            </View>
          </View>

          <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
            <ScrollView
              ref={formScrollRef}
              contentContainerStyle={[
                styles.formScrollContent,
                { paddingBottom: keyboardHeight > 0 ? keyboardHeight + 80 : 40 }
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
            >
              {/* Four Editable Configuration Fields */}
              <View style={styles.formCardsStack}>
                {fields.map((f, index) => {
                  const val = values[f.key];
                  const numVal = Number(val);
                  const isOutOfRange = val.length > 0 && (numVal < f.min || numVal > f.max);

                  return (
                    <View key={f.key} style={styles.formCard}>
                      <View style={styles.fieldLabelRow}>
                        <Text style={styles.fieldLabel}>
                          {index + 1}. {f.name}
                        </Text>
                        <View style={styles.unitBadge}>
                          <Text style={styles.unitBadgeText}>{f.unit}</Text>
                        </View>
                      </View>

                      <TextInput
                        accessibilityLabel={f.name}
                        keyboardType="number-pad"
                        value={val}
                        onChangeText={t => change(f.key, t)}
                        onFocus={() => {
                          setTimeout(() => {
                            formScrollRef.current?.scrollTo({ y: index * 125, animated: true });
                          }, 120);
                        }}
                        style={[styles.textInput, isOutOfRange && styles.textInputError]}
                        placeholder={f.hint}
                        placeholderTextColor="#94A3B8"
                      />

                      <View style={styles.fieldFooterRow}>
                        <Text style={styles.rangeHintText}>{f.hint}</Text>
                        <Text style={styles.rangeHelpText}>Range: {f.rangeText}</Text>
                      </View>
                    </View>
                  );
                })}

                {/* Super Admin Password Confirmation — Mandatory & Read-Only */}
                <View style={[styles.formCard, styles.readOnlyCard]}>
                  <View style={styles.fieldLabelRow}>
                    <Text style={styles.fieldLabel}>5. Super Admin Password Confirmation</Text>
                    <View style={styles.requiredPill}>
                      <Text style={styles.requiredPillText}>Required</Text>
                    </View>
                  </View>
                  <Text style={styles.readOnlyDescription}>
                    This setting is mandatory and cannot be turned off.
                  </Text>
                </View>

                {/* Current Password Confirmation Input */}
                <View style={styles.formCard}>
                  <Text style={styles.fieldLabel}>Confirm with your current password</Text>
                  <Text style={styles.passwordHintText}>
                    Enter your Super Admin password to authorize policy changes.
                  </Text>

                  <View style={styles.passwordInputContainer}>
                    <TextInput
                      accessibilityLabel="Current password"
                      value={currentPassword}
                      onChangeText={t => {
                        setCurrentPassword(t);
                        setReview(false);
                      }}
                      onFocus={() => {
                        setTimeout(() => {
                          formScrollRef.current?.scrollToEnd({ animated: true });
                        }, 120);
                      }}
                      secureTextEntry={!showPassword}
                      autoComplete="current-password"
                      maxLength={1024}
                      placeholder="Enter current password"
                      placeholderTextColor="#94A3B8"
                      style={styles.passwordTextInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                      onPress={() => setShowPassword(!showPassword)}
                      style={styles.passwordVisibilityButton}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      {showPassword ? (
                        <IconEyeOff size={20} color="#64748B" />
                      ) : (
                        <IconEye size={20} color="#64748B" />
                      )}
                    </Pressable>
                  </View>
                </View>

                {/* Review & Confirmation Step Banner */}
                {review && (
                  <View style={styles.reviewBanner}>
                    <Text style={styles.reviewBannerTitle}>Confirm policy change</Text>
                    <Text style={styles.reviewBannerText}>
                      Shorter limits may immediately expire existing staff sessions. This update is audited.
                    </Text>
                  </View>
                )}
              </View>

              {/* Form Actions: Cancel and Review Change / Confirm and Save */}
              <View style={styles.formActionsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Cancel editing"
                  style={styles.formCancelButton}
                  onPress={() => {
                    setEditing(false);
                    setReview(false);
                    setCurrentPassword("");
                  }}
                  disabled={busy}
                >
                  <Text style={styles.formCancelButtonText}>Cancel</Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={review ? "Confirm and save policy" : "Review change"}
                  disabled={!canSubmit}
                  style={[
                    styles.formSubmitButton,
                    !canSubmit && styles.formSubmitButtonDisabled
                  ]}
                  onPress={() => void save()}
                >
                  {busy ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.formSubmitButtonText}>
                      {review ? "Confirm and save" : "Review Change"}
                    </Text>
                  )}
                </Pressable>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  // -------------------------------------------------------------
  // PRIMARY VIEW: Integrated into Reusable AuthenticatedAppShell
  // -------------------------------------------------------------
  if (actor && handlers && onSignOut) {
    return (
      <AuthenticatedAppShell
        actor={actor}
        roleActions={roleActions}
        handlers={handlers}
        onSignOut={onSignOut}
        activeTabId="policy"
        hideWelcome={true}
        onOpenDashboard={onExit}
      >
        <View style={styles.root}>
          {/* Reusable Toast Notification Component */}
          <AuthToast toast={toast} onDismiss={hideToast} />
          {renderViewContent()}
        </View>
      </AuthenticatedAppShell>
    );
  }

  // Fallback if rendered outside AuthenticatedAppShell context
  return (
    <SafeAreaView style={styles.root}>
      <AuthToast toast={toast} onDismiss={hideToast} />
      {renderViewContent()}
    </SafeAreaView>
  );
}

// -------------------------------------------------------------
// Styles
// -------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  vectorBox: {
    alignItems: "center",
    justifyContent: "center"
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 100, // Extra space to clear the floating bottom navigation
    gap: 14
  },

  // Page Introduction
  introRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 2
  },
  introIconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center"
  },
  introTextBox: {
    flex: 1
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3
  },
  pageDescription: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18,
    marginTop: 2
  },

  // Action Buttons
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 2,
    marginBottom: 2
  },
  actionButton: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  refreshButton: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#CBD5E1"
  },
  refreshButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#0F172A"
  },
  editButton: {
    backgroundColor: "#059669",
    borderWidth: 1,
    borderColor: "#059669"
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  buttonPressed: {
    opacity: 0.85
  },
  buttonDisabled: {
    opacity: 0.45
  },

  // Skeleton Cards
  skeletonIconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#E2E8F0"
  },
  skeletonTitle: {
    width: 140,
    height: 14,
    borderRadius: 4,
    backgroundColor: "#E2E8F0"
  },
  skeletonValue: {
    width: 110,
    height: 20,
    borderRadius: 4,
    backgroundColor: "#CBD5E1",
    marginVertical: 6
  },
  skeletonRange: {
    width: 160,
    height: 12,
    borderRadius: 4,
    backgroundColor: "#E2E8F0"
  },

  // Cards Container
  cardsContainer: {
    gap: 12
  },
  configCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  cardIconBox: {
    width: 46,
    height: 46,
    borderRadius: 10,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center"
  },
  cardContentBox: {
    flex: 1,
    justifyContent: "center"
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
    marginBottom: 2
  },
  cardValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  cardRange: {
    fontSize: 13,
    fontWeight: "400",
    color: "#64748B",
    marginTop: 2
  },
  requiredPill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 10,
    paddingVertical: 2.5,
    borderRadius: 12,
    alignSelf: "flex-start",
    marginTop: 3,
    marginBottom: 3
  },
  requiredPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#15803D"
  },

  // Last Updated
  lastUpdatedContainer: {
    backgroundColor: "#F1F5F9",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2
  },
  lastUpdatedText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#0F172A"
  },

  // Recovery Card
  recoveryCard: {
    backgroundColor: "#FFFBEB",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 14,
    gap: 10,
    marginTop: 4
  },
  recoveryHint: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18
  },
  recoveryButton: {
    backgroundColor: "#F59E0B",
    borderRadius: 8,
    height: 40,
    alignItems: "center",
    justifyContent: "center"
  },
  recoveryButtonText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF"
  },

  // Edit Form Screen
  editRoot: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  formHeader: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF"
  },
  formBackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 10
  },
  formBackText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A"
  },
  formHeaderTitleWrap: {
    gap: 2
  },
  formTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  formSubtitle: {
    fontSize: 13,
    color: "#64748B"
  },
  formScrollContent: {
    padding: 16,
    gap: 14
  },
  formCardsStack: {
    gap: 12
  },
  formCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 16,
    gap: 8,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1
  },
  readOnlyCard: {
    backgroundColor: "#F8FAFC"
  },
  fieldLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A"
  },
  unitBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6
  },
  unitBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase"
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    color: "#0F172A",
    fontSize: 16,
    fontWeight: "600",
    paddingHorizontal: 14,
    minHeight: 48
  },
  textInputError: {
    borderColor: "#EF4444"
  },
  fieldFooterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  rangeHintText: {
    fontSize: 12,
    color: "#64748B"
  },
  rangeHelpText: {
    fontSize: 12,
    color: "#059669",
    fontWeight: "500"
  },
  readOnlyDescription: {
    fontSize: 13,
    color: "#64748B",
    lineHeight: 18
  },
  passwordHintText: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: -2
  },
  passwordInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    minHeight: 48
  },
  passwordTextInput: {
    flex: 1,
    paddingHorizontal: 14,
    fontSize: 16,
    color: "#0F172A",
    minHeight: 48
  },
  passwordVisibilityButton: {
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  reviewBanner: {
    backgroundColor: "#FEF3C7",
    borderColor: "#FCD34D",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    gap: 4
  },
  reviewBannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#92400E"
  },
  reviewBannerText: {
    fontSize: 13,
    color: "#78350F",
    lineHeight: 18
  },
  formActionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 8
  },
  formCancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center"
  },
  formCancelButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#475569"
  },
  formSubmitButton: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    backgroundColor: "#059669",
    alignItems: "center",
    justifyContent: "center"
  },
  formSubmitButtonDisabled: {
    opacity: 0.5
  },
  formSubmitButtonText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF"
  }
});
