import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Pressable, Animated } from "react-native";
import {
  IconCheckCircle,
  IconShieldAlert,
  IconInfo,
  IconClose
} from "./roles-permissions-icons";

export interface FeedbackBannerProps {
  type?: "success" | "error" | "warning" | "info";
  title?: string;
  message: string;
  onDismiss?: () => void;
}

export function FeedbackBanner({
  type = "info",
  title,
  message,
  onDismiss
}: FeedbackBannerProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true
      })
    ]).start();
  }, [fadeAnim, slideAnim]);

  let icon = <IconInfo size={18} color="#1D4ED8" />;
  let cardStyle = styles.infoCard;
  let titleStyle = styles.infoTitle;
  let textStyle = styles.infoText;

  if (type === "success") {
    icon = <IconCheckCircle size={18} color="#16A34A" />;
    cardStyle = styles.successCard;
    titleStyle = styles.successTitle;
    textStyle = styles.successText;
  } else if (type === "error") {
    icon = <IconShieldAlert size={18} color="#DC2626" />;
    cardStyle = styles.errorCard;
    titleStyle = styles.errorTitle;
    textStyle = styles.errorText;
  } else if (type === "warning") {
    icon = <IconShieldAlert size={18} color="#D97706" />;
    cardStyle = styles.warningCard;
    titleStyle = styles.warningTitle;
    textStyle = styles.warningText;
  }

  return (
    <Animated.View
      style={[
        styles.bannerBase,
        cardStyle,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
      accessibilityRole="alert"
    >
      <View style={styles.iconWrap}>{icon}</View>
      <View style={styles.textWrap}>
        {!!title && <Text style={[styles.titleBase, titleStyle]}>{title}</Text>}
        <Text style={[styles.messageBase, textStyle]}>{message}</Text>
      </View>
      {onDismiss && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss message"
          onPress={onDismiss}
          style={styles.closeBtn}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <IconClose size={15} color="#64748B" />
        </Pressable>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bannerBase: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 14,
    gap: 10
  },
  iconWrap: {
    marginTop: 1
  },
  textWrap: {
    flex: 1
  },
  titleBase: {
    fontSize: 13.5,
    fontWeight: "700",
    marginBottom: 2
  },
  messageBase: {
    fontSize: 12.5,
    fontWeight: "500",
    lineHeight: 18
  },
  closeBtn: {
    padding: 2
  },
  infoCard: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE"
  },
  infoTitle: {
    color: "#1E40AF"
  },
  infoText: {
    color: "#1E3A8A"
  },
  successCard: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0"
  },
  successTitle: {
    color: "#15803D"
  },
  successText: {
    color: "#166534"
  },
  errorCard: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA"
  },
  errorTitle: {
    color: "#B91C1C"
  },
  errorText: {
    color: "#991B1B"
  },
  warningCard: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A"
  },
  warningTitle: {
    color: "#B45309"
  },
  warningText: {
    color: "#92400E"
  }
});
