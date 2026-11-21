import React, { useCallback, useMemo, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable
} from "react-native";
import type { CG01SessionView } from "@careganga/api-contracts";
import {
  getAuthorizedModules,
  getDashboardFeaturedModules,
  type ModuleActionHandlers
} from "./dashboard-modules";
import { AuthenticatedAppShell } from "./authenticated-app-shell";
import { OperationsOverview } from "./operations-overview";
import {NativeMisDashboard} from "../mis-reporting/native-mis-dashboard";

import {NativeClinicianAccountAcceptance} from "../health-network/native-clinician-account-link";
import { AuthorizedModuleCard } from "./authorized-module-card";
import { IconGrid, IconMenu } from "./dashboard-icons";

export interface InternalDashboardScreenProps {
  actor: CG01SessionView;
  token: string;
  roleActions: string[];
  handlers: ModuleActionHandlers;
  onSignOut: () => void;
  onExpired?: () => void;
  message?: string;
}

export function InternalDashboardScreen({
  actor,
  roleActions,
  handlers,
  onSignOut,
  onExpired = onSignOut,
  token,
  message
}: InternalDashboardScreenProps) {
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);

  // Scroll to top when Dashboard tab is tapped
  const handleOpenDashboard = useCallback(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, []);

  // Primary featured dashboard modules matching the Web Foundation Dashboard structure
  const featuredModules = useMemo(() => {
    return getDashboardFeaturedModules(roleActions, actor, handlers);
  }, [roleActions, actor, handlers]);

  // Total authorized destinations for directory reference
  const totalAuthorizedCount = useMemo(() => {
    return getAuthorizedModules(roleActions, actor, handlers).length;
  }, [roleActions, actor, handlers]);

  const dashboardTitle =
    actor.scope === "Foundation"
      ? "Foundation Dashboard"
      : `${actor.scope} Dashboard`;

  const dashboardSubtitle =
    actor.scope === "Foundation"
      ? "CareGanga Foundation Management & Central Operations"
      : `CareGanga ${actor.scope} Management & Operations`;

  const modulesSectionTitle =
    actor.scope === "Foundation"
      ? "Authorized Foundation Modules"
      : "Authorized Modules";

  return (
    <AuthenticatedAppShell
      actor={actor}
      roleActions={roleActions}
      handlers={handlers}
      onSignOut={onSignOut}
      activeTabId="dashboard"
      onOpenDashboard={handleOpenDashboard}
    >
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Dashboard Heading */}
        <View style={styles.headingSection}>
          <Text style={styles.dashboardTitle}>{dashboardTitle}</Text>
          <Text style={styles.dashboardSubtitle}>{dashboardSubtitle}</Text>
        </View>

        {/* Global Informational / Alert Message if any */}
        {!!message && (
          <View style={styles.messageBanner}>
            <Text style={styles.messageText}>{message}</Text>
          </View>
        )}

        {/* Existing CG14 personal doctor-account acceptance, only visible when pending. */}
        <NativeClinicianAccountAcceptance token={token} onExpired={onExpired}/>

        {/* Operations Overview with 3 KPI Cards */}
        <OperationsOverview
          roleName={actor.roleName}
          scope={actor.scope}
        />

        {/* Private MIS on the staff dashboard only; no private Public Android mirror. */}
        {roleActions.includes("mis.dashboard.view")&&
          <NativeMisDashboard token={token} onExpired={onExpired}
            onOpenFinance={roleActions.includes("finance.reports.view")?handlers.openReports:undefined}
            onOpenPatientAdmin={roleActions.includes("health.patients.admin.view")&&
             roleActions.includes("foundation.branches.admin")?
             handlers.openPatientAdmin:undefined}/>}

        {/* Authorized Modules Section (Featured Quick Access matching Web Dashboard) */}
        <View style={styles.modulesSection}>
          <View style={styles.modulesHeaderRow}>
            <View style={styles.modulesHeaderLeft}>
              <IconGrid size={18} color="#0284C7" />
              <Text style={styles.modulesSectionTitle}>{modulesSectionTitle}</Text>
            </View>
            <Text style={styles.modulesCountBadge}>
              {featuredModules.length} {featuredModules.length === 1 ? "module" : "modules"}
            </Text>
          </View>

          <Text style={styles.modulesHelperText}>
            Quick access to your primary authorized operational modules.
          </Text>

          {/* Featured Module Cards */}
          {featuredModules.map(mod => (
            <AuthorizedModuleCard key={mod.key} module={mod} />
          ))}

          {/* Directory Access Banner */}
          {totalAuthorizedCount > featuredModules.length && (
            <View style={styles.directoryNoticeCard}>
              <View style={styles.directoryNoticeHeader}>
                <IconMenu size={16} color="#1D4ED8" />
                <Text style={styles.directoryNoticeTitle}>Complete Navigation Directory</Text>
              </View>
              <Text style={styles.directoryNoticeDesc}>
                Access all {totalAuthorizedCount} authorized modules and system tools anytime via the top-left menu or bottom navigation tabs.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </AuthenticatedAppShell>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1
  },
  scrollContent: {
    paddingBottom: 110 // Ensure content scrolls well above floating bottom navigation
  },
  headingSection: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 4
  },
  dashboardTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.3
  },
  dashboardSubtitle: {
    fontSize: 13,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 18
  },
  messageBanner: {
    marginHorizontal: 18,
    marginTop: 12,
    padding: 12,
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA"
  },
  messageText: {
    fontSize: 12.5,
    color: "#DC2626",
    fontWeight: "600"
  },
  modulesSection: {
    marginTop: 14,
    paddingHorizontal: 18
  },
  modulesHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  modulesHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  modulesSectionTitle: {
    fontSize: 16.5,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  modulesCountBadge: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B"
  },
  modulesHelperText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 12,
    lineHeight: 16
  },
  directoryNoticeCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 14,
    padding: 14,
    marginTop: 6,
    borderWidth: 1,
    borderColor: "#DBEAFE"
  },
  directoryNoticeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4
  },
  directoryNoticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  directoryNoticeDesc: {
    fontSize: 12,
    color: "#3B82F6",
    lineHeight: 16
  }
});
