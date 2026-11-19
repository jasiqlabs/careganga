import React, { useRef } from "react";
import {
  Pressable,
  Text,
  ActivityIndicator,
  StyleSheet,
  Animated,
  ViewStyle
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { IconArrowRight } from "./auth-icons";

interface LoginSubmitButtonProps {
  label?: string;
  loadingLabel?: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

export function LoginSubmitButton({
  label = "Sign In",
  loadingLabel = "Signing in...",
  loading = false,
  disabled = false,
  onPress,
  style
}: LoginSubmitButtonProps) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled || loading) return;
    Animated.spring(scaleAnim, {
      toValue: 0.98,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 50,
      bounciness: 4
    }).start();
  };

  const isDisabled = disabled || loading;

  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        accessibilityLabel={loading ? loadingLabel : label}
        disabled={isDisabled}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[styles.buttonWrapper, isDisabled && styles.buttonDisabled]}
      >
        <LinearGradient
          colors={["#1D4ED8", "#0284C7", "#10B981"]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.gradientContainer}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" accessibilityLabel={loadingLabel} />
          ) : (
            <Text style={styles.buttonText}>{label}</Text>
          )}

          {!loading && (
            <IconArrowRight size={18} color="#FFFFFF" />
          )}

          {loading && (
            <Text style={[styles.buttonText, { marginLeft: 8 }]}>{loadingLabel}</Text>
          )}
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  buttonWrapper: {
    height: 52,
    borderRadius: 26,
    overflow: "hidden",
    shadowColor: "#0284C7",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4
  },
  buttonDisabled: {
    opacity: 0.65,
    shadowOpacity: 0
  },
  gradientContainer: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    gap: 8
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.3
  }
});
