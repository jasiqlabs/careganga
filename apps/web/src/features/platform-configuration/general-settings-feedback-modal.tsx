"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  CheckCircle2Icon,
  AlertCircleIcon,
  AlertTriangleIcon,
  InfoIcon,
  XIcon,
  RefreshCwIcon,
  ArrowRightIcon
} from "./general-settings-icons";

export type FeedbackModalType = "success" | "error" | "warning" | "verification-required";
export type FeedbackModalBadge = "SUCCESS" | "ERROR" | "ACTION REQUIRED" | "VERIFICATION REQUIRED";

export interface FeedbackModalState {
  type: FeedbackModalType;
  title: string;
  badge?: FeedbackModalBadge;
  message: string;
  nextStep?: string;
  primaryActionLabel?: string;
  onPrimaryAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  onClose?: () => void;
  isBusy?: boolean;
  disableDismiss?: boolean;
  focusTargetOnClose?: string;
}

export interface GeneralSettingsFeedbackModalProps {
  feedback: FeedbackModalState | null;
  onDismiss: () => void;
}

export function GeneralSettingsFeedbackModal({
  feedback,
  onDismiss
}: GeneralSettingsFeedbackModalProps) {
  const modalRef = useRef<HTMLElement | null>(null);
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const isOpen = Boolean(feedback);

  // Capture active element before opening and manage focus restoration
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;

      // Small delay to let modal mount and focus the primary action
      const timer = setTimeout(() => {
        primaryBtnRef.current?.focus();
      }, 50);

      // Lock body scroll
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";

      return () => {
        clearTimeout(timer);
        document.body.style.overflow = prevOverflow;

        // Restore focus to targeted element (e.g. password input on Try Again) or previous element
        const targetId = feedback?.focusTargetOnClose;
        if (targetId) {
          const targetEl = document.getElementById(targetId);
          if (targetEl instanceof HTMLElement) {
            targetEl.focus();
            return;
          }
        }
        if (previousActiveElement.current && document.contains(previousActiveElement.current)) {
          previousActiveElement.current.focus();
        }
      };
    }
  }, [isOpen, feedback?.focusTargetOnClose]);

  // Keyboard trap and Escape handler
  useEffect(() => {
    if (!isOpen || !feedback) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (!feedback.disableDismiss && !feedback.isBusy) {
          e.preventDefault();
          if (feedback.onClose) {
            feedback.onClose();
          } else {
            onDismiss();
          }
        }
        return;
      }

      if (e.key !== "Tab") return;

      const controls = Array.from(
        modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter(el => el.getClientRects().length > 0);

      if (!controls.length) return;

      if (e.shiftKey && document.activeElement === controls[0]) {
        e.preventDefault();
        controls[controls.length - 1].focus();
      } else if (!e.shiftKey && document.activeElement === controls[controls.length - 1]) {
        e.preventDefault();
        controls[0].focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, feedback, onDismiss]);

  if (!feedback) return null;

  const {
    type,
    title,
    badge = type === "success"
      ? "SUCCESS"
      : type === "verification-required"
        ? "VERIFICATION REQUIRED"
        : type === "warning"
          ? "ACTION REQUIRED"
          : "ERROR",
    message,
    nextStep,
    primaryActionLabel = type === "success"
      ? "Done"
      : type === "error"
        ? "Try Again"
        : "Understood",
    onPrimaryAction,
    secondaryActionLabel,
    onSecondaryAction,
    onClose,
    isBusy = false,
    disableDismiss = false
  } = feedback;

  const handleClose = () => {
    if (isBusy || disableDismiss) return;
    if (onClose) {
      onClose();
    } else {
      onDismiss();
    }
  };

  const handlePrimaryClick = () => {
    if (isBusy) return;
    if (onPrimaryAction) {
      onPrimaryAction();
    } else {
      handleClose();
    }
  };

  const handleSecondaryClick = () => {
    if (isBusy || disableDismiss) return;
    if (onSecondaryAction) {
      onSecondaryAction();
    } else {
      handleClose();
    }
  };

  // Determine variant styling
  const isSuccess = type === "success";
  const isError = type === "error";
  const isVerification = type === "verification-required";
  const isWarning = type === "warning";

  const iconCircleClass = isSuccess
    ? "cg-gs-feedback-icon-success"
    : isError
      ? "cg-gs-feedback-icon-error"
      : isVerification
        ? "cg-gs-feedback-icon-verification"
        : "cg-gs-feedback-icon-warning";

  const badgeClass = isSuccess
    ? "cg-gs-feedback-badge-success"
    : isError
      ? "cg-gs-feedback-badge-error"
      : isVerification
        ? "cg-gs-feedback-badge-verification"
        : "cg-gs-feedback-badge-warning";

  return (
    <AnimatePresence>
      <motion.div
        className="cg-gs-feedback-backdrop"
        role="presentation"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.18 }}
        onClick={e => {
          if (e.target === e.currentTarget && !isBusy && !disableDismiss) {
            handleClose();
          }
        }}
      >
        <motion.section
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="cg-feedback-modal-title"
          aria-describedby="cg-feedback-modal-desc"
          className="cg-gs-feedback-modal"
          initial={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.94, y: 14 }
          }
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, scale: 0.94, y: 8 }
          }
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }
          }
        >
          {/* Top Bar with Icon, Badge & Optional Close Button */}
          <div className="cg-gs-feedback-header">
            <div className="cg-gs-feedback-icon-badge-row">
              <motion.div
                className={`cg-gs-feedback-icon-circle ${iconCircleClass}`}
                initial={prefersReducedMotion ? { opacity: 1 } : { scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { delay: 0.05, duration: 0.22, ease: "easeOut" }
                }
              >
                {isSuccess && <CheckCircle2Icon size={24} />}
                {isError && <AlertCircleIcon size={24} />}
                {isVerification && <AlertTriangleIcon size={24} />}
                {isWarning && <InfoIcon size={24} />}
              </motion.div>
              <span className={`cg-gs-feedback-badge ${badgeClass}`}>{badge}</span>
            </div>

            {!disableDismiss && !isBusy && (
              <button
                type="button"
                className="cg-gs-feedback-close-btn"
                onClick={handleClose}
                aria-label="Close feedback modal"
                title="Close"
              >
                <XIcon size={18} />
              </button>
            )}
          </div>

          {/* Body Content */}
          <div className="cg-gs-feedback-body">
            <h3 id="cg-feedback-modal-title" className="cg-gs-feedback-title">
              {title}
            </h3>

            <p id="cg-feedback-modal-desc" className="cg-gs-feedback-message">
              {message}
            </p>

            {nextStep && (
              <div className="cg-gs-feedback-next-step">
                <InfoIcon size={16} className="cg-gs-feedback-step-icon" />
                <div className="cg-gs-feedback-step-text">
                  <strong>Next step:</strong> {nextStep}
                </div>
              </div>
            )}
          </div>

          {/* Action Footer */}
          <footer className="cg-gs-feedback-footer">
            {secondaryActionLabel && (
              <button
                type="button"
                className="cg-gs-feedback-btn-secondary"
                disabled={isBusy}
                onClick={handleSecondaryClick}
              >
                <span>{secondaryActionLabel}</span>
              </button>
            )}

            <button
              ref={primaryBtnRef}
              type="button"
              className={`cg-gs-feedback-btn-primary ${
                isError
                  ? "is-error"
                  : isVerification || isWarning
                    ? "is-warning"
                    : "is-success"
              }`}
              disabled={isBusy}
              onClick={handlePrimaryClick}
            >
              {isBusy ? (
                <>
                  <RefreshCwIcon size={15} className="cg-gs-spin" />
                  <span>Processing…</span>
                </>
              ) : (
                <>
                  <span>{primaryActionLabel}</span>
                  {!isSuccess && !isBusy && <ArrowRightIcon size={14} />}
                </>
              )}
            </button>
          </footer>
        </motion.section>
      </motion.div>
    </AnimatePresence>
  );
}
