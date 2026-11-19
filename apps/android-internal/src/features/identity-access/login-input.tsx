import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  TextInputProps
} from "react-native";
import { IconUserRound, IconLockKeyhole, IconEye, IconEyeOff, IconAlertCircle } from "./auth-icons";

interface LoginInputProps extends TextInputProps {
  label: string;
  iconType: "user" | "lock";
  error?: string | boolean | null;
  hideErrorMessage?: boolean;
  isPassword?: boolean;
}

export function LoginInput({
  label,
  iconType,
  error,
  hideErrorMessage = false,
  isPassword = false,
  value,
  onChangeText,
  placeholder,
  onFocus,
  onBlur,
  ...rest
}: LoginInputProps) {
  const [isFocused, setIsFocused] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);

  const hasError = Boolean(error);
  const errorMessage = typeof error === "string" && error.trim().length > 0 ? error : null;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputFocused,
          hasError && styles.inputError
        ]}
      >
        {/* Left Icon */}
        <View style={styles.iconContainer}>
          {iconType === "user" ? (
            <IconUserRound size={19} color={isFocused ? "#2563EB" : hasError ? "#DC2626" : "#64748B"} />
          ) : (
            <IconLockKeyhole size={19} color={isFocused ? "#2563EB" : hasError ? "#DC2626" : "#64748B"} />
          )}
        </View>

        {/* Text Input */}
        <TextInput
          style={styles.textInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#94A3B8"
          secureTextEntry={isPassword && !passwordVisible}
          onFocus={(e) => {
            setIsFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            onBlur?.(e);
          }}
          accessibilityLabel={label}
          {...rest}
        />

        {/* Right Password Visibility Toggle */}
        {isPassword && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
            onPress={() => setPasswordVisible(v => !v)}
            style={styles.eyeToggle}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {passwordVisible ? (
              <IconEyeOff size={19} color="#64748B" />
            ) : (
              <IconEye size={19} color="#64748B" />
            )}
          </Pressable>
        )}
      </View>

      {/* Field Error Message */}
      {hasError && !hideErrorMessage && errorMessage && (
        <View style={styles.errorRow} accessibilityRole="alert">
          <IconAlertCircle size={14} color="#DC2626" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 14
  },
  label: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 7,
    letterSpacing: 0.2
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    height: 52,
    borderWidth: 1.4,
    borderColor: "#E2E8F0",
    borderRadius: 13,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 12
  },
  inputFocused: {
    borderColor: "#2563EB",
    backgroundColor: "#FFFFFF"
  },
  inputError: {
    borderColor: "#DC2626",
    backgroundColor: "#FEF2F2"
  },
  iconContainer: {
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6
  },
  textInput: {
    flex: 1,
    height: "100%",
    fontSize: 14.5,
    color: "#0F172A",
    paddingVertical: 0
  },
  eyeToggle: {
    padding: 6,
    alignItems: "center",
    justifyContent: "center"
  },
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 5,
    gap: 5
  },
  errorText: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "500",
    flex: 1
  }
});
