import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Modal,
  BackHandler,
  Platform,
  KeyboardAvoidingView,
  Dimensions
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { IconClose } from "./registration-approvals-icons";

export interface RegistrationBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: number | `${number}%`;
}

export function RegistrationBottomSheet({
  visible,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
  maxHeight = "92%"
}: RegistrationBottomSheetProps) {
  const insets = useSafeAreaInsets();
  const screenHeight = Dimensions.get("window").height;

  const slideAnim = useRef(new Animated.Value(screenHeight)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Animate open and close
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 24,
          stiffness: 220,
          mass: 0.9,
          useNativeDriver: true
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: screenHeight,
          duration: 200,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim, screenHeight]);

  // Android hardware back button handler
  useEffect(() => {
    if (!visible) return;
    const backSub = BackHandler.addEventListener("hardwareBackPress", () => {
      onClose();
      return true;
    });
    return () => backSub.remove();
  }, [visible, onClose]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        {/* Dimmed Backdrop */}
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: fadeAnim
            }
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityLabel="Close bottom sheet"
          />
        </Animated.View>

        {/* Keyboard-aware Sheet Container
            On Android: windowSoftInputMode="adjustResize" handles window resizing.
            We avoid adding keyboardHeight as padding to prevent double-avoidance / blank view collapse.
            On iOS: behavior="padding" provides smooth layout adjustment. */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={[styles.keyboardAvoidWrap, { maxHeight }]}
        >
          <Animated.View
            style={[
              styles.sheetContainer,
              {
                paddingBottom: Math.max(insets.bottom, 12),
                transform: [{ translateY: slideAnim }]
              }
            ]}
          >
            {/* Top Drag Handle Indicator */}
            <View style={styles.handleBarWrap}>
              <View style={styles.handleBar} />
            </View>

            {/* Header (if title or headerRight is provided) */}
            {(title || headerRight) && (
              <View style={styles.headerRow}>
                <View style={styles.titleWrap}>
                  {Boolean(title) && (
                    <Text accessibilityRole="header" style={styles.headerTitle}>
                      {title}
                    </Text>
                  )}
                  {Boolean(subtitle) && (
                    <Text style={styles.headerSubtitle}>{subtitle}</Text>
                  )}
                </View>

                <View style={styles.headerRightWrap}>
                  {headerRight}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Close sheet"
                    onPress={onClose}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={styles.closeBtn}
                  >
                    <IconClose size={18} color="#64748B" />
                  </Pressable>
                </View>
              </View>
            )}

            {/* Scrollable Sheet Content */}
            <View style={styles.contentContainer}>{children}</View>
          </Animated.View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.55)"
  },
  keyboardAvoidWrap: {
    width: "100%",
    justifyContent: "flex-end"
  },
  sheetContainer: {
    width: "100%",
    maxHeight: "100%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: -4 },
    shadowRadius: 16,
    elevation: 8,
    overflow: "hidden"
  },
  handleBarWrap: {
    alignItems: "center",
    paddingTop: 10,
    paddingBottom: 6
  },
  handleBar: {
    width: 40,
    height: 4.5,
    borderRadius: 3,
    backgroundColor: "#CBD5E1"
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9"
  },
  titleWrap: {
    flex: 1,
    gap: 2
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#64748B"
  },
  headerRightWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center"
  },
  contentContainer: {
    flexShrink: 1,
    minHeight: 0
  }
});
