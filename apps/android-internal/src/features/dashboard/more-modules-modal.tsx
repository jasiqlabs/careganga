import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Modal
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DashboardModuleItem } from "./dashboard-modules";
import { AuthorizedModuleCard } from "./authorized-module-card";
import { IconClose } from "./dashboard-icons";

export interface MoreModulesModalProps {
  visible: boolean;
  onClose: () => void;
  modules: DashboardModuleItem[];
}

export function MoreModulesModal({ visible, onClose, modules }: MoreModulesModalProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(300)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true
        })
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true
        }),
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 250,
          useNativeDriver: true
        })
      ]).start();
    }
  }, [visible, fadeAnim, slideAnim]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlayContainer}>
        {/* Backdrop Dismiss */}
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
            accessibilityLabel="Close more modules sheet"
          />
        </Animated.View>

        {/* Slide-Up Bottom Sheet */}
        <Animated.View
          style={[
            styles.sheetContainer,
            {
              paddingBottom: Math.max(20, insets.bottom + 10),
              transform: [{ translateY: slideAnim }]
            }
          ]}
        >
          {/* Top Handle Pill */}
          <View style={styles.handlePillWrap}>
            <View style={styles.handlePill} />
          </View>

          {/* Sheet Header */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sheetTitle}>More Authorized Modules</Text>
              <Text style={styles.sheetSubtitle}>
                Additional operational modules available for your access scope
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close sheet"
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconClose size={18} color="#64748B" />
            </Pressable>
          </View>

          {/* Modules List */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {modules.map(mod => (
              <AuthorizedModuleCard
                key={mod.key}
                module={{
                  ...mod,
                  onOpen: () => {
                    onClose();
                    mod.onOpen();
                  }
                }}
              />
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    justifyContent: "flex-end"
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(3, 19, 43, 0.6)"
  },
  sheetContainer: {
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "75%",
    paddingTop: 10,
    paddingHorizontal: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 16
  },
  handlePillWrap: {
    alignItems: "center",
    paddingVertical: 6
  },
  handlePill: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1"
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 12
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  sheetSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10
  },
  scrollView: {
    flexGrow: 0
  },
  scrollContent: {
    paddingVertical: 6
  }
});
