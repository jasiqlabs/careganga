import React, { useState, useEffect, useCallback, useMemo } from "react";
import { View, StyleSheet, BackHandler } from "react-native";
import type { CG01SessionView } from "@careganga/api-contracts";
import {
  getAuthorizedModules,
  getBottomNavTabs,
  type ModuleActionHandlers
} from "./dashboard-modules";
import { DashboardHeader } from "./dashboard-header";
import { DashboardBottomNav } from "./dashboard-bottom-nav";
import { NavigationDrawer } from "./navigation-drawer";
import { MoreModulesModal } from "./more-modules-modal";

export interface AuthenticatedAppShellProps {
  actor: CG01SessionView;
  roleActions: string[];
  handlers: ModuleActionHandlers;
  onSignOut: () => void;
  activeTabId?: string;
  onOpenDashboard?: () => void;
  children: React.ReactNode;
}

/**
 * Reusable Authenticated Application Shell for CareGanga Internal Android.
 * Coordinates Header, Hamburger Drawer, Dynamic Bottom Navigation, More Modules Modal,
 * and Android hardware Back navigation.
 */
export function AuthenticatedAppShell({
  actor,
  roleActions,
  handlers,
  onSignOut,
  activeTabId = "dashboard",
  onOpenDashboard,
  children
}: AuthenticatedAppShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  // Hardware Android Back button handler
  useEffect(() => {
    const onBackPress = () => {
      if (isDrawerOpen) {
        setIsDrawerOpen(false);
        return true;
      }
      if (isMoreOpen) {
        setIsMoreOpen(false);
        return true;
      }
      // On dashboard: prevent accidental app exit or premature logout
      return true;
    };

    const backSub = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => backSub.remove();
  }, [isDrawerOpen, isMoreOpen]);

  // Resolve all authorized modules for drawer directory and bottom navigation
  const authorizedModules = useMemo(() => {
    return getAuthorizedModules(roleActions, actor, handlers);
  }, [roleActions, actor, handlers]);

  // Handle open dashboard
  const handleOpenDashboard = useCallback(() => {
    if (onOpenDashboard) {
      onOpenDashboard();
    }
  }, [onOpenDashboard]);

  // Compute dynamic bottom navigation tabs (max 5 positions based on effective permissions)
  const { tabs: bottomTabs, moreModules } = useMemo(() => {
    return getBottomNavTabs(
      authorizedModules,
      handleOpenDashboard,
      () => setIsMoreOpen(true)
    );
  }, [authorizedModules, handleOpenDashboard]);

  // Has notifications permission
  const canViewNotifications = roleActions.includes("communications.notifications.view");

  const handleOpenNotifications = useCallback(() => {
    if (canViewNotifications) {
      handlers.openNotifications();
    }
  }, [canViewNotifications, handlers]);

  return (
    <View style={styles.shellContainer}>
      {/* Reusable Header */}
      <DashboardHeader
        displayName={actor.displayName}
        roleName={actor.roleName}
        hasNotifications={canViewNotifications}
        onOpenDrawer={() => setIsDrawerOpen(true)}
        onOpenNotifications={handleOpenNotifications}
      />

      {/* Screen Content */}
      <View style={styles.contentContainer}>{children}</View>

      {/* Reusable Floating Dynamic Bottom Navigation */}
      <DashboardBottomNav tabs={bottomTabs} activeTabId={activeTabId} />

      {/* Reusable Navigation Drawer */}
      <NavigationDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        displayName={actor.displayName}
        roleName={actor.roleName}
        scope={actor.scope}
        authorizedModules={authorizedModules}
        activeKey={activeTabId}
        onOpenDashboard={handleOpenDashboard}
        onSignOut={onSignOut}
      />

      {/* Reusable More Modules Modal */}
      <MoreModulesModal
        visible={isMoreOpen}
        onClose={() => setIsMoreOpen(false)}
        modules={moreModules}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  shellContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  contentContainer: {
    flex: 1
  }
});
