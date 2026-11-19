import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Platform,
  Pressable
} from "react-native";
import { IconAlertCircle, IconCheckCircle2 } from "./auth-icons";

export type ToastType = "error" | "success" | "info";

export interface ToastPayload {
  id?: string;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
}

interface AuthToastProps {
  toast: ToastPayload | null;
  onDismiss: () => void;
}

export function AuthToast({ toast, onDismiss }: AuthToastProps) {
  const [current, setCurrent] = useState<ToastPayload | null>(toast);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const progressAnim = useRef(new Animated.Value(1)).current;

  // Timers and animations references
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRunningRef = useRef<Animated.CompositeAnimation | null>(null);
  const progressAnimRunningRef = useRef<Animated.CompositeAnimation | null>(null);

  const clearPending = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (animRunningRef.current) {
      animRunningRef.current.stop();
      animRunningRef.current = null;
    }
    if (progressAnimRunningRef.current) {
      progressAnimRunningRef.current.stop();
      progressAnimRunningRef.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearPending();
    const exitAnim = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: false
      }),
      Animated.timing(slideAnim, {
        toValue: 30,
        duration: 200,
        useNativeDriver: false
      })
    ]);
    animRunningRef.current = exitAnim;
    exitAnim.start(({ finished }) => {
      if (finished) {
        setCurrent(null);
        onDismiss();
      }
    });
  }, [clearPending, fadeAnim, slideAnim, onDismiss]);

  useEffect(() => {
    if (!toast) {
      if (current) {
        dismissToast();
      }
      return;
    }

    clearPending();
    setCurrent(toast);

    // Reset animation values
    fadeAnim.setValue(0);
    slideAnim.setValue(40);
    progressAnim.setValue(1);

    const duration = toast.duration ?? 3000;

    // 1. Entrance animation (fade and horizontal slide in from right)
    const enterAnim = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        useNativeDriver: false
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
        useNativeDriver: false
      })
    ]);
    animRunningRef.current = enterAnim;
    enterAnim.start();

    // 2. Progress bar animation: shrinks from right to left over exactly `duration` ms
    const progAnim = Animated.timing(progressAnim, {
      toValue: 0,
      duration,
      useNativeDriver: false
    });
    progressAnimRunningRef.current = progAnim;
    progAnim.start();

    // 3. Strict 3000ms dismiss timer
    timerRef.current = setTimeout(() => {
      dismissToast();
    }, duration);

    return () => {
      clearPending();
    };
  }, [toast, clearPending, dismissToast, fadeAnim, slideAnim, progressAnim]);

  if (!current) {
    return null;
  }

  const isError = current.type === "error";

  // Interpolate progress width from "100%" down to "0%"
  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"]
  });

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.overlayContainer,
        {
          opacity: fadeAnim,
          transform: [{ translateX: slideAnim }]
        }
      ]}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLabel={`${current.title}: ${current.message}`}
        onPress={dismissToast}
        style={[
          styles.toastCard,
          isError ? styles.toastErrorCard : styles.toastSuccessCard
        ]}
      >
        <View style={styles.contentRow}>
          {/* Status Icon */}
          <View style={styles.iconBox}>
            {isError ? (
              <IconAlertCircle size={20} color="#F87171" />
            ) : (
              <IconCheckCircle2 size={20} color="#34D399" />
            )}
          </View>

          {/* Text Details */}
          <View style={styles.textBox}>
            <Text
              style={[
                styles.titleText,
                isError ? styles.titleError : styles.titleSuccess
              ]}
              numberOfLines={1}
            >
              {current.title}
            </Text>
            <Text
              style={[
                styles.messageText,
                isError ? styles.messageError : styles.messageSuccess
              ]}
              numberOfLines={2}
            >
              {current.message}
            </Text>
          </View>
        </View>

        {/* Thin bottom progress indicator that continuously shrinks from right to left */}
        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressBar,
              isError ? styles.progressError : styles.progressSuccess,
              { width: progressWidth }
            ]}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

/**
 * Lightweight hook to manage active toast state cleanly without global singletons.
 */
export function useAuthToast() {
  const [toast, setToast] = useState<ToastPayload | null>(null);

  const showToast = useCallback((payload: ToastPayload) => {
    setToast({
      ...payload,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    });
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
  }, []);

  return { toast, showToast, hideToast };
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: "absolute",
    top: Platform.OS === "android" ? 18 : 12,
    right: 14,
    zIndex: 9999,
    maxWidth: 340,
    minWidth: 260
  },
  toastCard: {
    borderRadius: 14,
    borderWidth: 1.2,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8
  },
  toastErrorCard: {
    backgroundColor: "#450A0A",
    borderColor: "rgba(239, 68, 68, 0.45)"
  },
  toastSuccessCard: {
    backgroundColor: "#064E3B",
    borderColor: "rgba(52, 211, 153, 0.45)"
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 10
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center"
  },
  textBox: {
    flex: 1
  },
  titleText: {
    fontSize: 13.5,
    fontWeight: "800",
    letterSpacing: 0.2,
    marginBottom: 2
  },
  titleError: {
    color: "#FEE2E2"
  },
  titleSuccess: {
    color: "#ECFDF5"
  },
  messageText: {
    fontSize: 12,
    fontWeight: "500",
    lineHeight: 16
  },
  messageError: {
    color: "#FECACA"
  },
  messageSuccess: {
    color: "#A7F3D0"
  },
  progressTrack: {
    height: 3,
    width: "100%",
    backgroundColor: "rgba(255, 255, 255, 0.12)"
  },
  progressBar: {
    height: "100%",
    alignSelf: "flex-start" // Shrinks from right to left
  },
  progressError: {
    backgroundColor: "#EF4444"
  },
  progressSuccess: {
    backgroundColor: "#10B981"
  }
});
