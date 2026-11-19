import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform
} from "react-native";
import {
  roleColorOptions,
  roleColor
} from "../../../../../../packages/design-tokens/src/index";
import { AuthenticatedScreenHeader } from "../../dashboard/authenticated-screen-header";
import { FeedbackBanner } from "./feedback-banner";
import {
  IconCheck,
  IconCheckCircle,
  IconShieldAlert,
  IconChevronDown,
  IconChevronUp,
  IconSearch,
  IconCheckboxChecked,
  IconCheckboxUnchecked,
  IconLock,
  IconCategoryRoles,
  IconCategoryAccounts,
  IconCategorySecurity,
  IconCategoryFinance,
  IconCategoryWebsite,
  IconCategoryApprovals,
  IconCategoryMembers,
  IconCategoryVolunteers
} from "./roles-permissions-icons";
import type { Role, Group, FormMode } from "./roles-permissions-types";

export interface ScreenCreateRoleWizardProps {
  mode: FormMode;
  sourceRole?: Role;
  groups: Group[];
  saving: boolean;
  error?: string;
  initialName?: string;
  initialDescription?: string;
  initialColorKey?: string;
  initialSelectedActions?: string[];
  copyCandidates: Role[];
  copySearching: boolean;
  onSearchCopyCandidates: (query: string) => void;
  onChooseCopySource: (source?: Role) => void;
  onSubmit: (data: {
    name: string;
    description: string;
    colorKey: string;
    actionKeys: string[];
  }) => void;
  onCancel: () => void;
}

/**
 * 3-Step Create / Edit / Copy Role Wizard
 * Streamlines workflow from 6 steps down to 3 high-cohesion logical steps:
 * - Step 1: Basic Information & Scope (Name, Description, Copy Source, Scope, Appearance Swatches, Live Preview)
 * - Step 2: Permission Assignment (Dynamic Category Accordions, Counts, Checkboxes, Select All)
 * - Step 3: Review & Save (Review Summary, Admin Notice, Save Action)
 */
export function ScreenCreateRoleWizard({
  mode,
  sourceRole,
  groups,
  saving,
  error,
  initialName = "",
  initialDescription = "",
  initialColorKey = "blue",
  initialSelectedActions = [],
  copyCandidates,
  copySearching,
  onSearchCopyCandidates,
  onChooseCopySource,
  onSubmit,
  onCancel
}: ScreenCreateRoleWizardProps) {
  // Step state (Exactly 3 steps: 1, 2, 3)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  // Stable editor-session identity tracking
  const sessionId = `${mode}:${sourceRole?.roleRef ?? "new"}`;
  const activeSessionRef = useRef(sessionId);

  // Form draft states (persists across Step 1, 2, 3 and parent re-renders)
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [colorKey, setColorKey] = useState(initialColorKey);
  const [selectedActions, setSelectedActions] = useState<string[]>(initialSelectedActions);
  const [selectedCopyRole, setSelectedCopyRole] = useState<Role | null>(
    sourceRole ?? null
  );

  // Only re-initialize if the editor session itself switches to a different role/mode
  useEffect(() => {
    if (activeSessionRef.current !== sessionId) {
      activeSessionRef.current = sessionId;
      setName(initialName);
      setDescription(initialDescription);
      setColorKey(initialColorKey);
      setSelectedActions(initialSelectedActions);
      setSelectedCopyRole(sourceRole ?? null);
      setCurrentStep(1);
      setTouchedName(false);
    }
  }, [sessionId, initialName, initialDescription, initialColorKey, initialSelectedActions, sourceRole]);

  // Compute assignable groups (matching Web CreateRoleDrawer: filters out groups with 0 assignable capabilities)
  const assignableGroups = useMemo(() => {
    return groups.filter(g =>
      g.actions.some(a => a.assignable || a.key === "roles.manage")
    );
  }, [groups]);

  // Compute all assignable capabilities across the platform (47 total)
  const allAssignableActions = useMemo(() => {
    return groups
      .flatMap(g => g.actions)
      .filter(a => a.assignable || a.key === "roles.manage");
  }, [groups]);

  // Copy candidate search query & state
  const [showCopySection, setShowCopySection] = useState(mode === "copy");
  const [copySearchQuery, setCopySearchQuery] = useState("");

  // Validation feedback
  const [touchedName, setTouchedName] = useState(false);

  // Accordion expand/collapse in Step 2
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    if (groups[0]) init[groups[0].group] = true;
    return init;
  });

  const toggleCategory = (groupName: string) => {
    setExpandedCategories(prev => ({
      ...prev,
      [groupName]: !prev[groupName]
    }));
  };

  const handleToggleAction = (actionKey: string) => {
    setSelectedActions(prev =>
      prev.includes(actionKey) ? prev.filter(k => k !== actionKey) : [...prev, actionKey]
    );
  };

  const handleSelectAllInGroup = (group: Group) => {
    const assignableKeys = group.actions
      .filter(a => a.assignable || a.key === "roles.manage")
      .map(a => a.key);
    const allSelected = assignableKeys.every(k => selectedActions.includes(k));

    if (allSelected) {
      setSelectedActions(prev => prev.filter(k => !assignableKeys.includes(k)));
    } else {
      setSelectedActions(prev => Array.from(new Set([...prev, ...assignableKeys])));
    }
  };

  const handleStepBack = () => {
    if (currentStep === 3) setCurrentStep(2);
    else if (currentStep === 2) setCurrentStep(1);
    else onCancel();
  };

  const handleStepNext = () => {
    setTouchedName(true);
    if (currentStep === 1) {
      if (name.trim().length < 2) return;
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    }
  };

  const handleFinalSubmit = () => {
    setTouchedName(true);
    if (name.trim().length < 2) {
      setCurrentStep(1);
      return;
    }
    if (saving) return;
    onSubmit({
      name: name.trim(),
      description: description.trim(),
      colorKey,
      actionKeys: selectedActions
    });
  };

  // Get matching category icon
  const getCategoryIcon = (groupName: string) => {
    const lower = groupName.toLowerCase();
    if (lower.includes("role") || lower.includes("access")) return <IconCategoryRoles size={18} color="#1D4ED8" />;
    if (lower.includes("account") || lower.includes("identity")) return <IconCategoryAccounts size={18} color="#059669" />;
    if (lower.includes("security") || lower.includes("audit") || lower.includes("policy")) return <IconCategorySecurity size={18} color="#0284C7" />;
    if (lower.includes("finance") || lower.includes("account") || lower.includes("voucher")) return <IconCategoryFinance size={18} color="#D97706" />;
    if (lower.includes("content") || lower.includes("website") || lower.includes("notice")) return <IconCategoryWebsite size={18} color="#7C3AED" />;
    if (lower.includes("registration") || lower.includes("approval") || lower.includes("proposal")) return <IconCategoryApprovals size={18} color="#16A34A" />;
    if (lower.includes("member")) return <IconCategoryMembers size={18} color="#2563EB" />;
    if (lower.includes("volunteer")) return <IconCategoryVolunteers size={18} color="#EC4899" />;
    return <IconCategoryRoles size={18} color="#1D4ED8" />;
  };

  const screenTitle = mode === "edit" ? "Edit Role" : mode === "copy" ? "Copy Role" : "Create Role";

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      {/* Workflow Navigation Header (Single header, no duplicate dashboard bar above it) */}
      <AuthenticatedScreenHeader
        variant="workflow"
        title={screenTitle}
        onBack={handleStepBack}
        onClose={onCancel}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* 3-Step Numbered Indicator Row */}
        <View style={styles.stepIndicatorRow} accessibilityLabel={`Step ${currentStep} of 3`}>
          {([1, 2, 3] as const).map(step => {
            const isCompleted = step < currentStep;
            const isCurrent = step === currentStep;

            return (
              <React.Fragment key={step}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Step ${step}: ${step === 1 ? "Basic Info & Scope" : step === 2 ? "Permission Assignment" : "Review & Save"}`}
                  disabled={step > currentStep}
                  onPress={() => setCurrentStep(step)}
                  style={[
                    styles.stepCircle,
                    isCurrent && styles.stepCircleActive,
                    isCompleted && styles.stepCircleCompleted
                  ]}
                >
                  <Text
                    style={[
                      styles.stepCircleText,
                      isCurrent && styles.stepCircleTextActive,
                      isCompleted && styles.stepCircleTextCompleted
                    ]}
                  >
                    {step}
                  </Text>
                </Pressable>
                {step < 3 && (
                  <View
                    style={[
                      styles.stepConnector,
                      step < currentStep && styles.stepConnectorCompleted
                    ]}
                  />
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Step Title & Subtitle */}
        <View style={styles.stepHeaderWrap}>
          <Text style={styles.stepTitle}>
            {currentStep === 1
              ? "1. Basic Information & Scope"
              : currentStep === 2
              ? "2. Permission Assignment"
              : "3. Review & Save"}
          </Text>
          <Text style={styles.stepSubtitle}>
            {currentStep === 1
              ? "Define role identity, description, appearance and base scope."
              : currentStep === 2
              ? "Assign authorized actions across platform capability groups."
              : "Review all details and commit role definition."}
          </Text>
        </View>

        {/* Error Feedback Banner */}
        {!!error && <FeedbackBanner type="error" message={error} />}

        {/* ------------------------------------------------------------- */}
        {/* STEP 1: BASIC INFORMATION & SCOPE                              */}
        {/* ------------------------------------------------------------- */}
        {currentStep === 1 && (
          <View style={styles.stepContent}>
            {/* Role Name Input */}
            <View style={styles.fieldSection}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Role Name *</Text>
                <Text style={styles.charCount}>{name.length} / 80</Text>
              </View>
              <TextInput
                accessibilityLabel="Role name"
                placeholder="e.g., Audit Manager"
                placeholderTextColor="#94A3B8"
                value={name}
                maxLength={80}
                onChangeText={setName}
                onBlur={() => setTouchedName(true)}
                style={[
                  styles.textInput,
                  touchedName && name.trim().length < 2 && styles.textInputError
                ]}
              />
              {touchedName && name.trim().length === 0 && (
                <Text style={styles.validationError}>Please enter a role name.</Text>
              )}
              {touchedName && name.trim().length === 1 && (
                <Text style={styles.validationError}>Role name must contain at least 2 characters.</Text>
              )}
            </View>

            {/* Description Input */}
            <View style={styles.fieldSection}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>Description</Text>
                <Text style={styles.charCount}>{description.length} / 350</Text>
              </View>
              <TextInput
                accessibilityLabel="Role description"
                placeholder="Enter role description (optional)"
                placeholderTextColor="#94A3B8"
                value={description}
                maxLength={350}
                multiline
                numberOfLines={3}
                onChangeText={setDescription}
                style={[styles.textInput, styles.multilineInput]}
              />
            </View>

            {/* Scope Information Card */}
            <View style={styles.scopeCard}>
              <Text style={styles.scopeCardTitle}>Scope: Entire Foundation</Text>
              <Text style={styles.scopeCardText}>
                Roles apply Foundation-wide with strict default-deny boundary enforcement across accounts and centers.
              </Text>
            </View>

            {/* Role Appearance Swatches */}
            <View style={styles.fieldSection}>
              <Text style={styles.fieldLabel}>Role Color</Text>
              <View style={styles.swatchesGrid}>
                {roleColorOptions.map(option => {
                  const isSelected = colorKey === option.key;
                  return (
                    <Pressable
                      key={option.key}
                      accessibilityRole="radio"
                      accessibilityLabel={option.name}
                      accessibilityState={{ checked: isSelected }}
                      onPress={() => setColorKey(option.key)}
                      style={[
                        styles.swatchRing,
                        isSelected && styles.swatchRingSelected
                      ]}
                    >
                      <View style={[styles.swatchDot, { backgroundColor: option.hex }]} />
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Live Role Preview Card */}
            <View style={styles.previewCard}>
              <View style={[styles.previewAvatar, { backgroundColor: roleColor(colorKey) }]}>
                <Text style={styles.previewAvatarText}>
                  {name.trim().slice(0, 2).toUpperCase() || "RO"}
                </Text>
              </View>
              <View style={styles.previewTextWrap}>
                <Text style={styles.previewRoleName} numberOfLines={1}>
                  {name || "New Role Name"}
                </Text>
                <Text style={styles.previewRoleMeta}>
                  Custom Role · Foundation Scope · {selectedActions.length} actions selected
                </Text>
              </View>
            </View>

            {/* Optional Accelerator: Copy Permissions From */}
            <View style={styles.copyAccordion}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toggle copy permissions options"
                onPress={() => setShowCopySection(prev => !prev)}
                style={styles.copyAccordionHeader}
              >
                <Text style={styles.copyAccordionTitle}>
                  {selectedCopyRole
                    ? `Copying from: ${selectedCopyRole.name}`
                    : "Copy Permissions from an Existing Role (Optional)"}
                </Text>
                {showCopySection ? (
                  <IconChevronUp size={16} color="#1D4ED8" />
                ) : (
                  <IconChevronDown size={16} color="#64748B" />
                )}
              </Pressable>

              {showCopySection && (
                <View style={styles.copyAccordionBody}>
                  {/* Start with no permissions option */}
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setSelectedCopyRole(null);
                      setSelectedActions([]);
                      onChooseCopySource();
                    }}
                    style={[
                      styles.copyOptionCard,
                      selectedCopyRole === null && styles.copyOptionCardActive
                    ]}
                  >
                    <Text style={styles.copyOptionTitle}>Start with no permissions</Text>
                    <Text style={styles.copyOptionSubtitle}>Configure permissions from scratch in Step 2</Text>
                  </Pressable>

                  {/* Find Role search */}
                  <View style={styles.searchBarRow}>
                    <TextInput
                      accessibilityLabel="Search role to copy"
                      placeholder="Search active role name…"
                      placeholderTextColor="#94A3B8"
                      value={copySearchQuery}
                      onChangeText={setCopySearchQuery}
                      style={styles.copySearchInput}
                    />
                    <Pressable
                      accessibilityRole="button"
                      disabled={copySearching}
                      onPress={() => onSearchCopyCandidates(copySearchQuery)}
                      style={styles.copySearchBtn}
                    >
                      <IconSearch size={16} color="#FFFFFF" />
                      <Text style={styles.copySearchBtnText}>
                        {copySearching ? "…" : "Find"}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Candidates */}
                  {copyCandidates.map(c => {
                    const isSelected = selectedCopyRole?.roleRef === c.roleRef;
                    return (
                      <Pressable
                        key={c.roleRef}
                        accessibilityRole="button"
                        onPress={() => {
                          setSelectedCopyRole(c);
                          onChooseCopySource(c);
                          setSelectedActions(c.actionKeys);
                          if (c.colorKey) setColorKey(c.colorKey);
                        }}
                        style={[
                          styles.candidateCard,
                          isSelected && styles.candidateCardSelected
                        ]}
                      >
                        <View style={styles.candidateTextWrap}>
                          <Text style={styles.candidateName}>{c.name}</Text>
                          <Text style={styles.candidateMeta}>
                            {c.actionKeys.length} allowed actions
                          </Text>
                        </View>
                        {isSelected && (
                          <View style={styles.selectedBadge}>
                            <IconCheck size={12} color="#FFFFFF" />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            {/* Next Action Button */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Proceed to Step 2: Permission Assignment"
              disabled={name.trim().length < 2}
              onPress={handleStepNext}
              style={[
                styles.primaryNavBtn,
                name.trim().length < 2 && styles.primaryNavBtnDisabled
              ]}
            >
              <Text style={styles.primaryNavBtnText}>Next: Assign Permissions</Text>
            </Pressable>
          </View>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 2: PERMISSION ASSIGNMENT                                  */}
        {/* ------------------------------------------------------------- */}
        {currentStep === 2 && (
          <View style={styles.stepContent}>
            {/* Dynamic Accordion Capability Groups (Filtered for Assignable Modules) */}
            <View style={styles.accordionContainer}>
              {assignableGroups.map(group => {
                const isExpanded = !!expandedCategories[group.group];
                const assignableActions = group.actions.filter(
                  a => a.assignable || a.key === "roles.manage"
                );
                const adminOnlyActions = group.actions.filter(
                  a => !a.assignable && a.key !== "roles.manage"
                );
                const selectedInGroup = assignableActions.filter(a =>
                  selectedActions.includes(a.key)
                ).length;

                return (
                  <View key={group.group} style={styles.accordionCard}>
                    {/* Category Header */}
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${group.group}: ${selectedInGroup} of ${assignableActions.length} selected`}
                      onPress={() => toggleCategory(group.group)}
                      style={styles.accordionHeader}
                    >
                      <View style={styles.accordionHeaderLeft}>
                        {isExpanded ? (
                          <IconChevronDown size={16} color="#0F172A" />
                        ) : (
                          <IconChevronUp size={16} color="#0F172A" />
                        )}
                        {getCategoryIcon(group.group)}
                        <Text style={styles.accordionCategoryTitle}>
                          {group.group}
                        </Text>
                        <View style={styles.categoryCountBadge}>
                          <Text style={styles.categoryCountText}>
                            ({selectedInGroup}/{assignableActions.length})
                          </Text>
                        </View>
                      </View>
                    </Pressable>

                    {/* Category Actions Checkbox List */}
                    {isExpanded && (
                      <View style={styles.accordionBody}>
                        {/* Assignable Actions (Interactive Checkboxes) */}
                        {assignableActions.map(action => {
                          const isChecked = selectedActions.includes(action.key);
                          return (
                            <Pressable
                              key={action.key}
                              accessibilityRole="checkbox"
                              accessibilityLabel={action.businessLabel}
                              accessibilityState={{ checked: isChecked }}
                              onPress={() => handleToggleAction(action.key)}
                              style={styles.checkboxRow}
                            >
                              {isChecked ? (
                                <IconCheckboxChecked size={20} />
                              ) : (
                                <IconCheckboxUnchecked size={20} />
                              )}
                              <Text style={styles.checkboxLabel}>
                                {action.businessLabel}
                              </Text>
                            </Pressable>
                          );
                        })}

                        {/* Administrator-Only Actions (Locked & Informative) */}
                        {adminOnlyActions.map(action => (
                          <View key={action.key} style={styles.lockedRow}>
                            <View style={styles.lockedIconBox}>
                              <IconLock size={15} color="#94A3B8" />
                            </View>
                            <View style={styles.lockedTextWrap}>
                              <Text style={styles.lockedLabel} numberOfLines={2}>
                                {action.businessLabel}
                              </Text>
                              <View style={styles.lockedBadge}>
                                <Text style={styles.lockedBadgeText}>System only</Text>
                              </View>
                            </View>
                          </View>
                        ))}

                        {/* Select All Toggle for Assignable Category Capabilities */}
                        {assignableActions.length > 1 && (
                          <Pressable
                            accessibilityRole="button"
                            onPress={() => handleSelectAllInGroup(group)}
                            style={styles.selectAllBtn}
                          >
                            <Text style={styles.selectAllBtnText}>
                              {selectedInGroup === assignableActions.length
                                ? "Deselect All in Group"
                                : "Select All in Group"}
                            </Text>
                          </Pressable>
                        )}
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Administrator-only permissions banner */}
            <View style={styles.adminOnlyNoticeCard}>
              <IconShieldAlert size={18} color="#1D4ED8" />
              <Text style={styles.adminOnlyNoticeText}>
                Administrator-only permissions are managed by the system. These permissions cannot be manually assigned or modified.
              </Text>
            </View>

            {/* Navigation Buttons Row */}
            <View style={styles.navButtonsRow}>
              <Pressable
                accessibilityRole="button"
                onPress={handleStepBack}
                style={styles.secondaryNavBtn}
              >
                <Text style={styles.secondaryNavBtnText}>Back</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Proceed to Step 3: Review & Save"
                onPress={handleStepNext}
                style={styles.primaryNavBtnHalf}
              >
                <Text style={styles.primaryNavBtnText}>Next: Review</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* ------------------------------------------------------------- */}
        {/* STEP 3: REVIEW & SAVE                                          */}
        {/* ------------------------------------------------------------- */}
        {currentStep === 3 && (
          <View style={styles.stepContent}>
            {/* Selected Count Hero Card */}
            <View style={styles.summaryCard}>
              <IconCheckCircle size={28} color="#16A34A" />
              <View style={styles.summaryCardTextWrap}>
                <Text style={styles.summaryCountText}>
                  {selectedActions.length} of {allAssignableActions.length} permissions selected
                </Text>
                <Text style={styles.summarySubtext}>
                  Across {assignableGroups.length} capability groups
                </Text>
              </View>
            </View>

            {/* Missing Name Warning Banner if Step 1 was bypassed or name was cleared */}
            {name.trim().length < 2 && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Role name is required. Tap to return to Step 1"
                onPress={() => setCurrentStep(1)}
                style={styles.missingNameBanner}
              >
                <IconShieldAlert size={18} color="#DC2626" />
                <View style={styles.missingNameBannerTextWrap}>
                  <Text style={styles.missingNameBannerTitle}>Role name is required</Text>
                  <Text style={styles.missingNameBannerSub}>
                    Tap here to return to Step 1 and provide a valid role name.
                  </Text>
                </View>
              </Pressable>
            )}

            {/* Role Details Review Card */}
            <View style={styles.detailsReviewCard}>
              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Role Name</Text>
                {name.trim().length >= 2 ? (
                  <Text style={styles.reviewValue}>{name.trim()}</Text>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Missing role name. Tap to enter in Step 1"
                    onPress={() => setCurrentStep(1)}
                    style={styles.missingNameBtn}
                  >
                    <Text style={styles.missingNameText}>Name required (tap to set)</Text>
                  </Pressable>
                )}
              </View>
              <View style={styles.reviewDivider} />

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Scope</Text>
                <Text style={styles.reviewValue}>Entire Foundation</Text>
              </View>
              <View style={styles.reviewDivider} />

              <View style={styles.reviewRow}>
                <Text style={styles.reviewLabel}>Color Swatch</Text>
                <View style={styles.reviewColorRow}>
                  <View style={[styles.swatchDotSmall, { backgroundColor: roleColor(colorKey) }]} />
                  <Text style={styles.reviewValue}>{colorKey}</Text>
                </View>
              </View>

              {selectedCopyRole && (
                <>
                  <View style={styles.reviewDivider} />
                  <View style={styles.reviewRow}>
                    <Text style={styles.reviewLabel}>Copied From</Text>
                    <Text style={styles.reviewValue}>{selectedCopyRole.name}</Text>
                  </View>
                </>
              )}

              {!!description && (
                <>
                  <View style={styles.reviewDivider} />
                  <View style={styles.reviewCol}>
                    <Text style={styles.reviewLabel}>Description</Text>
                    <Text style={styles.reviewDescription}>{description}</Text>
                  </View>
                </>
              )}
            </View>

            {/* Permissions Breakdown by Group */}
            <View style={styles.breakdownCard}>
              <Text style={styles.breakdownTitle}>Selected Permissions Breakdown</Text>
              {assignableGroups.map(g => {
                const assignableInGroup = g.actions.filter(
                  a => a.assignable || a.key === "roles.manage"
                );
                const count = assignableInGroup.filter(a => selectedActions.includes(a.key)).length;
                if (count === 0) return null;
                return (
                  <View key={g.group} style={styles.breakdownRow}>
                    <Text style={styles.breakdownGroupName}>{g.group}</Text>
                    <Text style={styles.breakdownGroupCount}>
                      {count} of {assignableInGroup.length} actions
                    </Text>
                  </View>
                );
              })}
              {selectedActions.length === 0 && (
                <Text style={styles.emptyBreakdownText}>
                  No permissions currently selected for this role.
                </Text>
              )}
            </View>

            {/* Administrator Security Notice Card */}
            <View style={styles.adminSecurityCard}>
              <IconShieldAlert size={20} color="#1D4ED8" />
              <Text style={styles.adminSecurityText}>
                Administrator-only permissions are managed by the system. These permissions cannot be manually assigned or modified.
              </Text>
            </View>

            {/* Action Buttons Row */}
            <View style={styles.navButtonsRow}>
              <Pressable
                accessibilityRole="button"
                disabled={saving}
                onPress={handleStepBack}
                style={styles.secondaryNavBtn}
              >
                <Text style={styles.secondaryNavBtnText}>Back</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Save role"
                disabled={saving || name.trim().length < 2}
                onPress={handleFinalSubmit}
                style={[
                  styles.saveRoleBtn,
                  (saving || name.trim().length < 2) && styles.saveRoleBtnDisabled
                ]}
              >
                {saving ? (
                  <View style={styles.savingRow}>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.saveRoleBtnText}>Saving…</Text>
                  </View>
                ) : (
                  <>
                    <IconCheck size={16} color="#FFFFFF" />
                    <Text style={styles.saveRoleBtnText}>Save Role</Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC"
  },
  scrollView: {
    flex: 1
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40
  },
  stepIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF"
  },
  stepCircleActive: {
    borderColor: "#1D4ED8",
    backgroundColor: "#1D4ED8"
  },
  stepCircleCompleted: {
    borderColor: "#1D4ED8",
    backgroundColor: "#EFF6FF"
  },
  stepCircleText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B"
  },
  stepCircleTextActive: {
    color: "#FFFFFF"
  },
  stepCircleTextCompleted: {
    color: "#1D4ED8"
  },
  stepConnector: {
    width: 36,
    height: 2,
    backgroundColor: "#CBD5E1"
  },
  stepConnectorCompleted: {
    backgroundColor: "#1D4ED8"
  },
  stepHeaderWrap: {
    marginBottom: 16
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: -0.2
  },
  stepSubtitle: {
    fontSize: 12.5,
    color: "#64748B",
    marginTop: 2
  },
  stepContent: {
    gap: 14
  },
  fieldSection: {
    gap: 6
  },
  labelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center"
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  charCount: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#94A3B8"
  },
  textInput: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A"
  },
  textInputError: {
    borderColor: "#DC2626"
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top"
  },
  validationError: {
    fontSize: 12,
    color: "#DC2626",
    fontWeight: "600",
    marginTop: 2
  },
  scopeCard: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    padding: 12,
    gap: 3
  },
  scopeCardTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1E40AF"
  },
  scopeCardText: {
    fontSize: 12,
    color: "#1E3A8A",
    lineHeight: 17
  },
  swatchesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    paddingVertical: 6
  },
  swatchRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
    justifyContent: "center"
  },
  swatchRingSelected: {
    borderColor: "#0F172A"
  },
  swatchDot: {
    width: 28,
    height: 28,
    borderRadius: 14
  },
  swatchDotSmall: {
    width: 14,
    height: 14,
    borderRadius: 7
  },
  previewCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    padding: 12,
    gap: 12
  },
  previewAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  previewAvatarText: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF"
  },
  previewTextWrap: {
    flex: 1
  },
  previewRoleName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0F172A"
  },
  previewRoleMeta: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 1
  },
  copyAccordion: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden"
  },
  copyAccordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    backgroundColor: "#F8FAFC"
  },
  copyAccordionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    flex: 1,
    paddingRight: 8
  },
  copyAccordionBody: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 10
  },
  copyOptionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 10
  },
  copyOptionCardActive: {
    borderColor: "#1D4ED8",
    backgroundColor: "#EFF6FF"
  },
  copyOptionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  copyOptionSubtitle: {
    fontSize: 11.5,
    color: "#64748B",
    marginTop: 2
  },
  searchBarRow: {
    flexDirection: "row",
    gap: 8
  },
  copySearchInput: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 40,
    fontSize: 13,
    color: "#0F172A"
  },
  copySearchBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1D4ED8",
    borderRadius: 8,
    paddingHorizontal: 12,
    gap: 4
  },
  copySearchBtnText: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  candidateCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    padding: 10
  },
  candidateCardSelected: {
    borderColor: "#1D4ED8",
    backgroundColor: "#EFF6FF"
  },
  candidateTextWrap: {
    flex: 1
  },
  candidateName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0F172A"
  },
  candidateMeta: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1
  },
  selectedBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#1D4ED8",
    alignItems: "center",
    justifyContent: "center"
  },
  accordionContainer: {
    gap: 8
  },
  accordionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    overflow: "hidden"
  },
  accordionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#F8FAFC"
  },
  accordionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1
  },
  accordionCategoryTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A"
  },
  categoryCountBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 8,
    backgroundColor: "#DCFCE7"
  },
  categoryCountText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#15803D"
  },
  accordionBody: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    gap: 8
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 3
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1E293B",
    flex: 1
  },
  selectAllBtn: {
    paddingTop: 4,
    alignSelf: "flex-start"
  },
  selectAllBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  lockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 5,
    opacity: 0.85
  },
  lockedIconBox: {
    width: 20,
    alignItems: "center",
    justifyContent: "center"
  },
  lockedTextWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8
  },
  lockedLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748B",
    flex: 1
  },
  lockedBadge: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0"
  },
  lockedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B"
  },
  adminOnlyNoticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    padding: 12,
    gap: 10
  },
  adminOnlyNoticeText: {
    flex: 1,
    fontSize: 12,
    color: "#1E40AF",
    lineHeight: 17,
    fontWeight: "500"
  },
  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: "#BBF7D0",
    borderRadius: 12,
    padding: 14,
    gap: 12
  },
  missingNameBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 10,
    padding: 12,
    gap: 10,
    marginBottom: 10
  },
  missingNameBannerTextWrap: {
    flex: 1
  },
  missingNameBannerTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626"
  },
  missingNameBannerSub: {
    fontSize: 11.5,
    color: "#B91C1C",
    marginTop: 2
  },
  missingNameBtn: {
    backgroundColor: "#FEE2E2",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6
  },
  missingNameText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#DC2626"
  },
  summaryCardTextWrap: {
    flex: 1
  },
  summaryCountText: {
    fontSize: 16,
    fontWeight: "800",
    color: "#15803D"
  },
  summarySubtext: {
    fontSize: 12,
    color: "#16A34A",
    marginTop: 1
  },
  detailsReviewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7
  },
  reviewCol: {
    paddingVertical: 7
  },
  reviewColorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  reviewLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B"
  },
  reviewValue: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A"
  },
  reviewDescription: {
    fontSize: 13,
    color: "#334155",
    marginTop: 3,
    lineHeight: 18
  },
  reviewDivider: {
    height: 1,
    backgroundColor: "#F1F5F9"
  },
  breakdownCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    gap: 8
  },
  breakdownTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 3
  },
  breakdownGroupName: {
    fontSize: 12.5,
    color: "#334155"
  },
  breakdownGroupCount: {
    fontSize: 12.5,
    fontWeight: "700",
    color: "#1D4ED8"
  },
  emptyBreakdownText: {
    fontSize: 12.5,
    color: "#94A3B8"
  },
  adminSecurityCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 10,
    padding: 12,
    gap: 10
  },
  adminSecurityText: {
    flex: 1,
    fontSize: 12,
    color: "#1E40AF",
    lineHeight: 17,
    fontWeight: "500"
  },
  navButtonsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 6
  },
  primaryNavBtn: {
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6
  },
  primaryNavBtnDisabled: {
    backgroundColor: "#94A3B8"
  },
  primaryNavBtnHalf: {
    flex: 1,
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center"
  },
  secondaryNavBtn: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center"
  },
  primaryNavBtnText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  secondaryNavBtnText: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#0F172A"
  },
  saveRoleBtn: {
    flex: 1.4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#1D4ED8",
    borderRadius: 10,
    paddingVertical: 13,
    gap: 6
  },
  saveRoleBtnDisabled: {
    backgroundColor: "#94A3B8"
  },
  saveRoleBtnText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#FFFFFF"
  },
  savingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  }
});
