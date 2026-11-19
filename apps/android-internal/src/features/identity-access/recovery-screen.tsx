import React, { useRef, useState, useEffect } from "react";
import {
  SafeAreaView,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Animated
} from "react-native";
import * as Crypto from "expo-crypto";
import { identityRequest } from "./http-client";
import { AuthAmbientBackground } from "./auth-ambient-background";
import { LoginBranding } from "./login-branding";
import { LoginSubmitButton } from "./login-submit-button";
import {
  IconPadlockShieldLarge,
  IconUserRound,
  IconLockKeyhole,
  IconEye,
  IconEyeOff,
  IconMail,
  IconSmartphone,
  IconCheckCircle2,
  IconAlertCircle,
  IconArrowLeft
} from "./auth-icons";
import { AuthToast, useAuthToast } from "./auth-toast";

export function RecoveryScreen({ onExit }: { onExit: () => void }) {
  const [step, setStep] = useState<"request" | "confirm">("request");
  const [identifier, setIdentifier] = useState("");
  const [channel, setChannel] = useState<"sms" | "email">("sms");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [unknown, setUnknown] = useState(false);
  const [complete, setComplete] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"identifier" | "code" | "newPassword" | "confirmPassword" | null>(null);
  const [fieldError, setFieldError] = useState<"identifier" | "code" | "newPassword" | "confirmPassword" | null>(null);
  const [animDone, setAnimDone] = useState(false);
  const key = useRef("");

  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const focusedFieldRef = useRef<"identifier" | "code" | "newPassword" | "confirmPassword" | null>(null);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidShow" : "keyboardWillShow",
      (e) => {
        const height = e.endCoordinates.height;
        setKeyboardHeight(height);
        if (focusedFieldRef.current) {
          const targetY =
            focusedFieldRef.current === "confirmPassword"
              ? 270
              : focusedFieldRef.current === "newPassword"
                ? 200
                : 120;
          scrollRef.current?.scrollTo({ y: targetY, animated: true });
        }
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "android" ? "keyboardDidHide" : "keyboardWillHide",
      () => {
        setKeyboardHeight(0);
        focusedFieldRef.current = null;
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }
    );

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const onFieldFocus = (field: "identifier" | "code" | "newPassword" | "confirmPassword") => {
    focusedFieldRef.current = field;
    setFocusedInput(field);
    const targetY =
      field === "confirmPassword"
        ? 270
        : field === "newPassword"
          ? 200
          : 120;
    scrollRef.current?.scrollTo({ y: targetY, animated: true });
  };

  const { toast, showToast, hideToast } = useAuthToast();

  // Card slide-up entrance animation
  const cardAnim = useRef(new Animated.Value(20)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true
      }),
      Animated.timing(cardAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true
      })
    ]).start(() => setAnimDone(true));
  }, [cardAnim, cardOpacity]);

  async function submit() {
    if (busy || unknown) return;

    if (step === "request") {
      if (!identifier.trim()) {
        const reqMsg = "Please enter your registered mobile number or email.";
        setMessage(reqMsg);
        setFieldError("identifier");
        showToast({
          type: "error",
          title: "Required Field Missing",
          message: reqMsg
        });
        return;
      }
    }

    if (step === "confirm") {
      if (!code.trim() || code.length !== 6) {
        const otpReqMsg = "Please enter the complete 6-digit verification code.";
        setMessage(otpReqMsg);
        setFieldError("code");
        showToast({
          type: "error",
          title: "Invalid Verification Code",
          message: otpReqMsg
        });
        return;
      }
      if (newPassword.length < 8) {
        const passLenMsg = "New password must be at least 8 characters long.";
        setMessage(passLenMsg);
        setFieldError("newPassword");
        showToast({
          type: "error",
          title: "Password Too Short",
          message: passLenMsg
        });
        return;
      }
      if (confirmPassword && newPassword !== confirmPassword) {
        const mismatchMsg = "Your passwords do not match. Please verify both fields.";
        setMessage(mismatchMsg);
        setFieldError("confirmPassword");
        showToast({
          type: "error",
          title: "Passwords Do Not Match",
          message: mismatchMsg
        });
        return;
      }
    }

    setBusy(true);
    setMessage("");
    setFieldError(null);

    if (step === "request" && !key.current) {
      key.current = Crypto.randomUUID();
    }

    try {
      const response = await identityRequest("/api/identity/recovery/" + step, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          step === "request"
            ? { identifier: identifier.trim(), channel, requestKey: key.current }
            : { identifier: identifier.trim(), otp: code, newPassword }
        )
      });

      if (!response.ok) {
        if (response.status === 400 && step === "confirm") {
          const otpMsg = "The code you entered is incorrect. Please try again.";
          setMessage(otpMsg);
          setFieldError("code");
          showToast({
            type: "error",
            title: "Invalid Verification Code",
            message: otpMsg
          });
        } else {
          const errTitle = response.status === 429 ? "Too Many Attempts" : "Recovery Error";
          const errMsg = response.status === 429
            ? "Too many attempts. Try again later."
            : response.status === 400
              ? "Check OTP and password details."
              : "Recovery is temporarily unavailable.";
          setMessage(errMsg);
          showToast({
            type: "error",
            title: errTitle,
            message: errMsg
          });
        }
        if (step === "confirm" && response.status >= 500) {
          setUnknown(true);
        }
        return;
      }

      if (step === "request") {
        setStep("confirm");
        const sentMsg = "If this account exists, an OTP will be sent to the registered contact.";
        setMessage(sentMsg);
        showToast({
          type: "success",
          title: "OTP Sent",
          message: sentMsg
        });
      } else {
        setComplete(true);
        setCode("");
        setNewPassword("");
        setConfirmPassword("");
        const successMsg = "Your password has been successfully updated. You can now sign in.";
        setMessage(successMsg);
        showToast({
          type: "success",
          title: "Password Reset Complete",
          message: successMsg
        });
      }
    } catch {
      const connMsg = "We’re unable to connect right now. Please check your network and try again.";
      setMessage(connMsg);
      showToast({
        type: "error",
        title: "Connection Failed",
        message: connMsg
      });
      if (step === "confirm") setUnknown(true);
    } finally {
      setBusy(false);
    }
  }

  const isRequestDisabled = busy || !identifier.trim();
  const isConfirmDisabled =
    busy ||
    !identifier.trim() ||
    code.length !== 6 ||
    newPassword.length < 8 ||
    (confirmPassword.length > 0 && confirmPassword !== newPassword);

  return (
    <SafeAreaView style={styles.safeArea}>
      {/* Deep Navy Glowing Background */}
      <AuthAmbientBackground />

      {/* Top-Right Scoped Auth Toast Notification */}
      <AuthToast toast={toast} onDismiss={hideToast} />

      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        enabled={Platform.OS === "ios"}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="none"
          contentContainerStyle={[
            styles.scrollContent,
            keyboardHeight > 0 && { paddingBottom: keyboardHeight + 40 }
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Branding */}
          <LoginBranding />

          {/* White Recovery Card */}
          <Animated.View
            style={[
              styles.cardContainer,
              animDone
                ? { opacity: 1 }
                : {
                  opacity: cardOpacity,
                  transform: [{ translateY: cardAnim }]
                }
            ]}
          >
            {/* Top Centered Icon Badge */}
            <View style={styles.badgeWrap}>
              {complete ? (
                <IconCheckCircle2 size={52} color="#10B981" />
              ) : (
                <IconPadlockShieldLarge size={52} />
              )}
            </View>

            {/* Title & Subtitle */}
            <Text accessibilityRole="header" style={styles.cardHeading}>
              {complete
                ? "Password Reset Complete"
                : step === "request"
                  ? "Forgot your password?"
                  : "Verify OTP & Reset Password"}
            </Text>

            <Text style={styles.cardSubheading}>
              {complete
                ? "Your password has been successfully updated. You can now securely sign in to your CareGanga account."
                : step === "request"
                  ? "Don't worry. We'll help you securely recover access to your account."
                  : "Enter the 6-digit OTP sent to your registered contact and choose a strong new password."}
            </Text>

            {/* SCREEN 1: Identifier & Channel Selection */}
            {step === "request" && !complete && (
              <View style={styles.formGroup}>
                <Text style={styles.inputLabel}>Registered Mobile Number or Email</Text>
                <View
                  style={[
                    styles.inputBox,
                    focusedInput === "identifier" && styles.inputBoxFocused,
                    fieldError === "identifier" && styles.inputBoxError
                  ]}
                >
                  <View style={styles.iconSlot}>
                    {identifier.includes("@") ? (
                      <IconMail
                        size={19}
                        color={
                          focusedInput === "identifier"
                            ? "#2563EB"
                            : fieldError === "identifier"
                              ? "#DC2626"
                              : "#64748B"
                        }
                      />
                    ) : (
                      <IconUserRound
                        size={19}
                        color={
                          focusedInput === "identifier"
                            ? "#2563EB"
                            : fieldError === "identifier"
                              ? "#DC2626"
                              : "#64748B"
                        }
                      />
                    )}
                  </View>
                  <TextInput
                    accessibilityLabel="Registered mobile number or email"
                    autoComplete="username"
                    autoCapitalize="none"
                    value={identifier}
                    placeholder="Enter mobile number or email"
                    placeholderTextColor="#94A3B8"
                    editable={!busy}
                    onFocus={() => onFieldFocus("identifier")}
                    onBlur={() => setFocusedInput(null)}
                    onChangeText={x => {
                      setIdentifier(x);
                      setChannel(x.includes("@") ? "email" : "sms");
                      if (fieldError === "identifier") setFieldError(null);
                      if (message) setMessage("");
                    }}
                    style={styles.textInput}
                  />
                </View>
                {fieldError === "identifier" && !!message && (
                  <View style={styles.alertRow} accessibilityRole="alert">
                    <IconAlertCircle size={14} color="#DC2626" />
                    <Text style={styles.alertText}>{message}</Text>
                  </View>
                )}

                {/* OTP Delivery Channel Selector */}
                <Text style={[styles.inputLabel, { marginTop: 14 }]}>Receive OTP via</Text>
                <View style={styles.channelRow}>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: channel === "sms" }}
                    accessibilityLabel="Receive OTP via SMS"
                    onPress={() => setChannel("sms")}
                    style={[
                      styles.channelPill,
                      channel === "sms" && styles.channelPillSelected
                    ]}
                  >
                    <IconSmartphone size={17} color={channel === "sms" ? "#FFFFFF" : "#64748B"} />
                    <Text
                      style={[
                        styles.channelText,
                        channel === "sms" && styles.channelTextSelected
                      ]}
                    >
                      SMS
                    </Text>
                  </Pressable>

                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: channel === "email" }}
                    accessibilityLabel="Receive OTP via Email"
                    onPress={() => setChannel("email")}
                    style={[
                      styles.channelPill,
                      channel === "email" && styles.channelPillSelected
                    ]}
                  >
                    <IconMail size={17} color={channel === "email" ? "#FFFFFF" : "#64748B"} />
                    <Text
                      style={[
                        styles.channelText,
                        channel === "email" && styles.channelTextSelected
                      ]}
                    >
                      Email
                    </Text>
                  </Pressable>
                </View>

                {/* Primary Action Button */}
                <LoginSubmitButton
                  label="Send Reset OTP"
                  loadingLabel="Sending OTP..."
                  loading={busy}
                  disabled={isRequestDisabled}
                  onPress={() => void submit()}
                  style={{ marginTop: 18 }}
                />
              </View>
            )}

            {/* SCREEN 2: OTP Verification & Password Reset */}
            {step === "confirm" && !complete && (
              <View style={styles.formGroup}>
                {/* 6-Digit OTP */}
                <Text style={styles.inputLabel}>Six-digit Password Reset OTP</Text>
                <View
                  style={[
                    styles.inputBox,
                    focusedInput === "code" && styles.inputBoxFocused,
                    fieldError === "code" && styles.inputBoxError
                  ]}
                >
                  <TextInput
                    accessibilityLabel="Password reset OTP"
                    keyboardType="number-pad"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={code}
                    placeholder="• • • • • •"
                    placeholderTextColor="#94A3B8"
                    onFocus={() => onFieldFocus("code")}
                    onBlur={() => setFocusedInput(null)}
                    onChangeText={v => {
                      setCode(v.replace(/\D/g, "").slice(0, 6));
                      if (fieldError === "code") setFieldError(null);
                      if (message) setMessage("");
                    }}
                    style={[styles.textInput, styles.otpInput]}
                  />
                </View>
                {fieldError === "code" && !!message && (
                  <View style={styles.alertRow} accessibilityRole="alert">
                    <IconAlertCircle size={14} color="#DC2626" />
                    <Text style={styles.alertText}>{message}</Text>
                  </View>
                )}

                {/* New Password */}
                <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                  New Password (8 or more characters)
                </Text>
                <View
                  style={[
                    styles.inputBox,
                    focusedInput === "newPassword" && styles.inputBoxFocused,
                    fieldError === "newPassword" && styles.inputBoxError
                  ]}
                >
                  <View style={styles.iconSlot}>
                    <IconLockKeyhole
                      size={19}
                      color={
                        focusedInput === "newPassword"
                          ? "#2563EB"
                          : fieldError === "newPassword"
                            ? "#DC2626"
                            : "#64748B"
                      }
                    />
                  </View>
                  <TextInput
                    accessibilityLabel="New password"
                    secureTextEntry={!passwordVisible}
                    autoComplete="new-password"
                    value={newPassword}
                    placeholder="Enter new password"
                    placeholderTextColor="#94A3B8"
                    onFocus={() => onFieldFocus("newPassword")}
                    onBlur={() => setFocusedInput(null)}
                    onChangeText={v => {
                      setNewPassword(v);
                      if (fieldError === "newPassword" || fieldError === "confirmPassword") setFieldError(null);
                      if (message) setMessage("");
                    }}
                    style={styles.textInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                    onPress={() => setPasswordVisible(v => !v)}
                    style={styles.eyeBtn}
                  >
                    {passwordVisible ? (
                      <IconEyeOff size={18} color="#64748B" />
                    ) : (
                      <IconEye size={18} color="#64748B" />
                    )}
                  </Pressable>
                </View>
                {fieldError === "newPassword" && !!message && (
                  <View style={styles.alertRow} accessibilityRole="alert">
                    <IconAlertCircle size={14} color="#DC2626" />
                    <Text style={styles.alertText}>{message}</Text>
                  </View>
                )}

                {/* Confirm New Password */}
                <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                  Confirm New Password
                </Text>
                <View
                  style={[
                    styles.inputBox,
                    focusedInput === "confirmPassword" && styles.inputBoxFocused,
                    fieldError === "confirmPassword" && styles.inputBoxError
                  ]}
                >
                  <View style={styles.iconSlot}>
                    <IconLockKeyhole
                      size={19}
                      color={
                        focusedInput === "confirmPassword"
                          ? "#2563EB"
                          : fieldError === "confirmPassword"
                            ? "#DC2626"
                            : "#64748B"
                      }
                    />
                  </View>
                  <TextInput
                    accessibilityLabel="Confirm new password"
                    secureTextEntry={!confirmPasswordVisible}
                    autoComplete="new-password"
                    value={confirmPassword}
                    placeholder="Confirm new password"
                    placeholderTextColor="#94A3B8"
                    onFocus={() => onFieldFocus("confirmPassword")}
                    onBlur={() => setFocusedInput(null)}
                    onChangeText={v => {
                      setConfirmPassword(v);
                      if (fieldError === "confirmPassword") setFieldError(null);
                      if (message) setMessage("");
                    }}
                    style={styles.textInput}
                  />
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={confirmPasswordVisible ? "Hide confirm password" : "Show confirm password"}
                    onPress={() => setConfirmPasswordVisible(v => !v)}
                    style={styles.eyeBtn}
                  >
                    {confirmPasswordVisible ? (
                      <IconEyeOff size={18} color="#64748B" />
                    ) : (
                      <IconEye size={18} color="#64748B" />
                    )}
                  </Pressable>
                </View>
                {fieldError === "confirmPassword" && !!message && (
                  <View style={styles.alertRow} accessibilityRole="alert">
                    <IconAlertCircle size={14} color="#DC2626" />
                    <Text style={styles.alertText}>{message}</Text>
                  </View>
                )}

                {/* Password mismatch hint */}
                {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                  <View style={styles.alertRow}>
                    <IconAlertCircle size={14} color="#DC2626" />
                    <Text style={styles.alertText}>Passwords do not match.</Text>
                  </View>
                )}

                {/* Submit Reset Button */}
                {!unknown && (
                  <LoginSubmitButton
                    label="Reset Password"
                    loadingLabel="Resetting Password..."
                    loading={busy}
                    disabled={isConfirmDisabled}
                    onPress={() => void submit()}
                    style={{ marginTop: 18 }}
                  />
                )}

                {/* Resend OTP button */}
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={() => {
                    setStep("request");
                    setCode("");
                    setNewPassword("");
                    setConfirmPassword("");
                    key.current = "";
                    setMessage("Request a new OTP after the resend cooldown.");
                  }}
                  style={styles.resendButton}
                >
                  <Text style={styles.resendText}>Request another OTP</Text>
                </Pressable>
              </View>
            )}

            {/* Notification / Alert Banner */}
            {!!message && (
              <View
                style={[
                  styles.messageBanner,
                  complete ? styles.messageSuccess : styles.messageNotice
                ]}
                accessibilityRole="alert"
              >
                {complete ? (
                  <IconCheckCircle2 size={16} color="#16A34A" />
                ) : (
                  <IconAlertCircle size={16} color="#0284C7" />
                )}
                <Text
                  style={[
                    styles.messageText,
                    complete && { color: "#166534" }
                  ]}
                >
                  {message}
                </Text>
              </View>
            )}

            {/* Unknown status message */}
            {unknown && (
              <View style={[styles.messageBanner, styles.messageWarning]}>
                <IconAlertCircle size={16} color="#D97706" />
                <Text style={[styles.messageText, { color: "#B45309" }]}>
                  Check whether your password changed before retrying. Contact support if needed.
                </Text>
              </View>
            )}

            {/* Return to Sign In CTA */}
            {complete ? (
              <LoginSubmitButton
                label="Back to Sign In"
                onPress={onExit}
                style={{ marginTop: 16 }}
              />
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Return to sign in"
                onPress={onExit}
                style={styles.backButton}
              >
                <IconArrowLeft size={16} color="#1D4ED8" />
                <Text style={styles.backButtonText}>Return to Sign In</Text>
              </Pressable>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#03132B"
  },
  keyboardContainer: {
    flex: 1
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: "center"
  },
  cardContainer: {
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#FFFFFF",
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 26,
    marginTop: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 22,
    elevation: 8
  },
  badgeWrap: {
    alignSelf: "center",
    marginBottom: 8
  },
  cardHeading: {
    fontSize: 21,
    fontWeight: "800",
    color: "#0F172A",
    textAlign: "center",
    marginTop: 4
  },
  cardSubheading: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 18,
    paddingHorizontal: 10
  },
  formGroup: {
    width: "100%"
  },
  inputLabel: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 7
  },
  inputBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderWidth: 1.4,
    borderColor: "#E2E8F0",
    borderRadius: 13,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12
  },
  inputBoxFocused: {
    borderColor: "#2563EB",
    backgroundColor: "#FFFFFF"
  },
  inputBoxError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2"
  },
  iconSlot: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 14.5,
    color: "#0F172A"
  },
  otpInput: {
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 10
  },
  eyeBtn: {
    padding: 6
  },
  channelRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4
  },
  channelPill: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 46,
    borderRadius: 12,
    borderWidth: 1.4,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
    gap: 8
  },
  channelPillSelected: {
    borderColor: "#2563EB",
    backgroundColor: "#1D4ED8"
  },
  channelText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569"
  },
  channelTextSelected: {
    color: "#FFFFFF"
  },
  alertRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
    gap: 5
  },
  alertText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "500"
  },
  messageBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    marginTop: 14,
    gap: 8
  },
  messageNotice: {
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD"
  },
  messageSuccess: {
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0"
  },
  messageWarning: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A"
  },
  messageText: {
    fontSize: 13,
    color: "#0369A1",
    fontWeight: "500",
    flex: 1
  },
  resendButton: {
    alignSelf: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginTop: 10
  },
  resendText: {
    fontSize: 13.5,
    color: "#2563EB",
    fontWeight: "700"
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    marginTop: 14,
    gap: 6
  },
  backButtonText: {
    fontSize: 14,
    color: "#1D4ED8",
    fontWeight: "700"
  }
});
