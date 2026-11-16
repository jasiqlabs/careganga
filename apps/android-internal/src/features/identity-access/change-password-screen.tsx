import { SafeAreaView } from "react-native-safe-area-context";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { identityRequest } from "./http-client";
import { careGangaTheme } from "../../../../../packages/design-tokens/src/index";

export function ChangePasswordScreen({ token, onExit, onExpired }: { token: string; onExit: () => void; onExpired: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit() {
    if (busy || !currentPassword || newPassword.length < 14) return;
    setBusy(true);
    setMessage("");
    setSuccess(false);

    try {
      const response = await identityRequest("/api/identity/change-password", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          totp: totp.trim() ? totp.trim() : undefined
        })
      });

      if (response.status === 401) {
        onExpired();
        return;
      }

      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) {
        setMessage(data?.message ?? "Password update could not be confirmed.");
      } else {
        setSuccess(true);
        setMessage(data?.message ?? "Password updated successfully. Other device sessions revoked.");
        setCurrentPassword("");
        setNewPassword("");
        setTotp("");
      }
    } catch {
      setMessage("We could not confirm the outcome. Check before submitting again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.page}>
      <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>Change account password</Text>
          <View style={styles.formCard}>
            <Text style={styles.muted}>
              Setting a new password will revoke any active sessions on other devices.
            </Text>
            <Text style={styles.label}>Current password</Text>
            <TextInput
              accessibilityLabel="Current password"
              secureTextEntry
              autoComplete="current-password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              style={styles.input}
            />
            <Text style={styles.label}>New password (14 or more characters)</Text>
            <TextInput
              accessibilityLabel="New password"
              secureTextEntry
              autoComplete="new-password"
              value={newPassword}
              onChangeText={setNewPassword}
              style={styles.input}
            />
            <Text style={styles.label}>Authenticator code (if privileged)</Text>
            <TextInput
              accessibilityLabel="Authenticator code"
              keyboardType="number-pad"
              maxLength={6}
              value={totp}
              onChangeText={v => setTotp(v.replace(/\D/g, ""))}
              style={styles.input}
            />

            {!!message && <Text accessibilityRole="alert" style={styles.message}>{message}</Text>}

            {!success && (
              <Pressable
                accessibilityRole="button"
                disabled={busy || !currentPassword || newPassword.length < 14}
                onPress={() => void submit()}
                style={[styles.button, styles.primaryButton]}
              >
                <Text style={styles.primaryButtonText}>{busy ? "Updating…" : "Update password"}</Text>
              </Pressable>
            )}

            <Pressable accessibilityRole="button" style={styles.button} onPress={onExit}>
              <Text>{success ? "Return to my account" : "Cancel"}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: careGangaTheme.background },
  content: { minHeight: "100%", padding: 24, gap: 14, justifyContent: "center", width: "100%", maxWidth: 680, alignSelf: "center" },
  title: { fontSize: 25, fontWeight: "700", color: careGangaTheme.text },
  muted: { color: careGangaTheme.sidebarMuted, fontSize: 14 },
  formCard: { padding: 20, backgroundColor: careGangaTheme.surface, borderWidth: 1, borderColor: careGangaTheme.border, borderRadius: 12, gap: 12 },
  label: { fontWeight: "600", color: careGangaTheme.text },
  input: { minHeight: 48, borderWidth: 1, borderColor: careGangaTheme.border, borderRadius: 7, paddingHorizontal: 12, backgroundColor: careGangaTheme.surface, color: careGangaTheme.text },
  button: { minHeight: 48, borderWidth: 1, borderColor: careGangaTheme.border, borderRadius: 7, alignItems: "center", justifyContent: "center", padding: 12 },
  primaryButton: { backgroundColor: careGangaTheme.primary, borderColor: careGangaTheme.primary },
  primaryButtonText: { color: careGangaTheme.primaryText, fontWeight: "700" },
  message: { borderWidth: 1, borderColor: careGangaTheme.border, padding: 12, color: careGangaTheme.text, backgroundColor: careGangaTheme.surface }
});
