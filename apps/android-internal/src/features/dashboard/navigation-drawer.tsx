import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  ScrollView,
  Animated,
  Dimensions,
  Modal,
  TextInput,
  Platform,
  StatusBar
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { DashboardModuleItem } from "./dashboard-modules";
import { groupModulesByCategory } from "./dashboard-modules";
import {
  IconClose,
  IconHome,
  IconUser,
  IconUsers,
  IconShield,
  IconLock,
  IconApprovals,
  IconFileText,
  IconCoins,
  IconReceipt,
  IconBuilding,
  IconHelpCircle,
  IconBarChart3,
  IconWallet,
  IconSliders,
  IconKey,
  IconMail,
  IconSend,
  IconBell,
  IconLogOut,
  IconSearch
} from "./dashboard-icons";

export interface NavigationDrawerProps {
  visible: boolean;
  onClose: () => void;
  displayName: string;
  roleName: string;
  scope: string;
  authorizedModules: DashboardModuleItem[];
  activeKey?: string;
  onOpenDashboard: () => void;
  onSignOut: () => void;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(SCREEN_WIDTH * 0.82, 320);

export function NavigationDrawer({
  visible,
  onClose,
  displayName,
  roleName,
  scope,
  authorizedModules,
  activeKey = "dashboard",
  onSignOut
}: NavigationDrawerProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [drawerSearchQuery, setDrawerSearchQuery] = useState("");

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
          duration: 280,
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
          toValue: -DRAWER_WIDTH,
          duration: 250,
          useNativeDriver: true
        })
      ]).start();
      setDrawerSearchQuery("");
    }
  }, [visible, fadeAnim, slideAnim]);

  // Compute accurate Android top status-bar padding without double-offset gap
  const statusBarHeight =
    Platform.OS === "android"
      ? StatusBar.currentHeight ?? insets.top ?? 24
      : insets.top;
  const topPadding = Math.max(statusBarHeight, 16) + 8;

  // Filter authorized modules based on sidebar search
  const filteredModules = useMemo(() => {
    const q = drawerSearchQuery.trim().toLowerCase();
    if (!q) return authorizedModules;
    return authorizedModules.filter(
      mod =>
        mod.title.toLowerCase().includes(q) ||
        mod.category.toLowerCase().includes(q) ||
        mod.shortLabel.toLowerCase().includes(q)
    );
  }, [authorizedModules, drawerSearchQuery]);

  const grouped = useMemo(() => {
    return groupModulesByCategory(filteredModules);
  }, [filteredModules]);

  if (!visible) return null;

  const renderModuleIcon = (iconName: DashboardModuleItem["iconName"], isActive: boolean) => {
    const color = isActive ? "#FFFFFF" : "#94A3B8";

    switch (iconName) {
      case "home":
        return <IconHome size={18} color={color} />;
      case "user":
        return <IconUser size={18} color={color} />;
      case "users":
        return <IconUsers size={18} color={color} />;
      case "shield":
        return <IconShield size={18} color={color} />;
      case "lock":
        return <IconLock size={18} color={color} />;
      case "approvals":
        return <IconApprovals size={18} color={color} />;
      case "documents":
      case "file-text":
        return <IconFileText size={18} color={color} />;
      case "coins":
        return <IconCoins size={18} color={color} />;
      case "receipt":
        return <IconReceipt size={18} color={color} />;
      case "building":
        return <IconBuilding size={18} color={color} />;
      case "support":
        return <IconHelpCircle size={18} color={color} />;
      case "bar-chart":
        return <IconBarChart3 size={18} color={color} />;
      case "wallet":
        return <IconWallet size={18} color={color} />;
      case "sliders":
        return <IconSliders size={18} color={color} />;
      case "key":
        return <IconKey size={18} color={color} />;
      case "mail":
        return <IconMail size={18} color={color} />;
      case "send":
        return <IconSend size={18} color={color} />;
      case "notifications":
        return <IconBell size={18} color={color} />;
      default:
        return <IconFileText size={18} color={color} />;
    }
  };

  return (
    <Modal
      transparent
      statusBarTranslucent
      visible={visible}
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={styles.overlayContainer}>
        {/* Backdrop overlay */}
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
            accessibilityLabel="Close navigation menu"
          />
        </Animated.View>

        {/* Slide-in Drawer Container */}
        <Animated.View
          style={[
            styles.drawerContainer,
            {
              width: DRAWER_WIDTH,
              paddingTop: topPadding,
              paddingBottom: Math.max(16, insets.bottom + 10),
              transform: [{ translateX: slideAnim }]
            }
          ]}
        >
          {/* Drawer Top Header Row: CareGanga Logo + Close Button */}
          <View style={styles.drawerHeader}>
            <View style={styles.drawerBrandRow}>
              <Image
                source={require("../../../assets/careganga-mark.png")}
                accessibilityLabel="CareGanga Foundation Logo"
                style={styles.drawerLogo}
              />
              <View>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <Text style={styles.drawerBrandCare}>Care</Text>
                  <Text style={styles.drawerBrandGanga}>Ganga</Text>
                </View>
                <Text style={styles.drawerBrandSub}>FOUNDATION</Text>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close navigation drawer"
              onPress={onClose}
              style={styles.drawerCloseButton}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <IconClose size={18} color="#CBD5E1" />
            </Pressable>
          </View>

          {/* User Identity Card */}
          <View style={styles.userIdentityCard}>
            <Text style={styles.identityName} numberOfLines={1}>
              {displayName || "Staff Member"}
            </Text>
            <View style={styles.identityBadgesRow}>
              <View style={styles.rolePill}>
                <Text style={styles.rolePillText}>{roleName || "Staff"}</Text>
              </View>
              <View style={styles.scopePill}>
                <Text style={styles.scopePillText}>{scope || "Foundation"}</Text>
              </View>
            </View>
            <View style={styles.verifiedRow}>
              <View style={styles.verifiedDot} />
              <Text style={styles.verifiedText}>Active &amp; Verified Session</Text>
            </View>
          </View>

          {/* Sidebar Search Input */}
          <View style={styles.sidebarSearchWrap}>
            <View style={styles.sidebarSearchBox}>
              <IconSearch size={16} color="#94A3B8" />
              <TextInput
                style={styles.sidebarSearchInput}
                placeholder="Search menu..."
                placeholderTextColor="#94A3B8"
                value={drawerSearchQuery}
                onChangeText={setDrawerSearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {drawerSearchQuery.length > 0 && (
                <Pressable
                  onPress={() => setDrawerSearchQuery("")}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.searchClearButton}
                  accessibilityLabel="Clear search text"
                >
                  <IconClose size={13} color="#94A3B8" />
                </Pressable>
              )}
            </View>
          </View>

          {/* Scrollable Navigation Groups matching Web 5-section Hierarchy */}
          <ScrollView
            style={styles.navScroll}
            contentContainerStyle={styles.navScrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {filteredModules.length > 0 ? (
              grouped.map(grp => (
                <View key={grp.category} style={styles.groupContainer}>
                  <Text style={styles.groupTitle}>{grp.category}</Text>
                  {grp.modules.map(mod => {
                    const isActive = activeKey === mod.key;
                    return (
                      <Pressable
                        key={mod.key}
                        accessibilityRole="button"
                        accessibilityLabel={mod.title}
                        onPress={() => {
                          onClose();
                          mod.onOpen();
                        }}
                        style={[styles.navItem, isActive && styles.navItemActive]}
                      >
                        {renderModuleIcon(mod.iconName, isActive)}
                        <Text
                          style={[styles.navItemLabel, isActive && styles.navItemLabelActive]}
                          numberOfLines={1}
                        >
                          {mod.title}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              ))
            ) : (
              <View style={styles.noResultsBox}>
                <Text style={styles.noResultsTitle}>No matching menu items</Text>
                <Text style={styles.noResultsSubtitle}>
                  No authorized navigation destinations match &quot;{drawerSearchQuery}&quot;.
                </Text>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setDrawerSearchQuery("")}
                  style={styles.noResultsClearBtn}
                >
                  <Text style={styles.noResultsClearText}>Clear Search</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>

          {/* Bottom Drawer Footer: Sign Out Button */}
          <View style={styles.drawerFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Sign out of account"
              onPress={() => {
                onClose();
                onSignOut();
              }}
              style={styles.signOutButton}
            >
              <IconLogOut size={18} color="#FCA5A5" />
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    flex: 1,
    flexDirection: "row"
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(3, 19, 43, 0.65)"
  },
  drawerContainer: {
    height: "100%",
    backgroundColor: "#0A1F44",
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 20,
    paddingHorizontal: 16
  },
  drawerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)"
  },
  drawerBrandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9
  },
  drawerLogo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    resizeMode: "contain"
  },
  drawerBrandCare: {
    fontSize: 16.5,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  drawerBrandGanga: {
    fontSize: 16.5,
    fontWeight: "800",
    color: "#10B981"
  },
  drawerBrandSub: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 1.5,
    marginTop: -2
  },
  drawerCloseButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)"
  },
  userIdentityCard: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)"
  },
  identityName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 6
  },
  identityBadgesRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 6
  },
  rolePill: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8
  },
  rolePillText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D"
  },
  scopePill: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8
  },
  scopePillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#E2E8F0"
  },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5
  },
  verifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#22C55E"
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#86EFAC"
  },
  sidebarSearchWrap: {
    marginBottom: 10
  },
  sidebarSearchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 11,
    paddingHorizontal: 10,
    height: 38,
    gap: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)"
  },
  sidebarSearchInput: {
    flex: 1,
    fontSize: 13,
    color: "#FFFFFF",
    paddingVertical: 0
  },
  searchClearButton: {
    padding: 4
  },
  navScroll: {
    flex: 1
  },
  navScrollContent: {
    paddingVertical: 4
  },
  groupContainer: {
    marginBottom: 14
  },
  groupTitle: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#64748B",
    letterSpacing: 1.2,
    marginBottom: 6,
    paddingHorizontal: 8
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    paddingHorizontal: 10,
    borderRadius: 10,
    gap: 10
  },
  navItemActive: {
    backgroundColor: "#1E53DC"
  },
  navItemLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#CBD5E1",
    flex: 1
  },
  navItemLabelActive: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  noResultsBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    paddingHorizontal: 12
  },
  noResultsTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 4
  },
  noResultsSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 12
  },
  noResultsClearBtn: {
    backgroundColor: "#1E53DC",
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8
  },
  noResultsClearText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  drawerFooter: {
    paddingTop: 10,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)"
  },
  signOutButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)"
  },
  signOutText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FCA5A5"
  }
});
