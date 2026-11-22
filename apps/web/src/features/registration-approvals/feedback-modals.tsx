"use client";

import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { IconCheck, IconX, IconAlertTriangle } from "./registration-approvals-icons";

export interface SuccessModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  actionText?: string;
  onClose: () => void;
}

interface FeedbackDescriptionProps {
  text: string;
}

function FeedbackDescription({ text }: FeedbackDescriptionProps) {
  const parts = text.split(/(CG-AP-\d+|ACC-\d+)/g);
  return (
    <p className="cg-ra-feedback-desc">
      {parts.map((part, i) => {
        if (/^(CG-AP-\d+|ACC-\d+)$/.test(part)) {
          return (
            <strong key={i} style={{ color: "#0F172A", fontWeight: 700, padding: "0 0.2rem" }}>
              {part}
            </strong>
          );
        }
        return part;
      })}
    </p>
  );
}

export function SuccessModal({
  isOpen,
  title,
  description,
  actionText = "OK",
  onClose
}: SuccessModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="cg-ra-modal-backdrop" role="presentation" onClick={onClose}>
          <motion.div
            className="cg-ra-feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cg-ra-success-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <button
              type="button"
              className="cg-ra-modal-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <IconX size={18} />
            </button>

            <div className="cg-ra-feedback-icon-wrap success">
              <motion.div
                initial={{ scale: 0.4, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <IconCheck size={32} />
              </motion.div>
            </div>

            <h3 id="cg-ra-success-title" className="cg-ra-feedback-title">
              {title}
            </h3>
            <FeedbackDescription text={description} />

            <div className="cg-ra-feedback-actions">
              <button
                type="button"
                className="cg-ra-btn-primary full-width"
                onClick={onClose}
                autoFocus
              >
                {actionText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export interface ErrorModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  actionText?: string;
  onRetry?: () => void;
  onClose: () => void;
}

export function ErrorModal({
  isOpen,
  title,
  description,
  actionText = "Try Again",
  onRetry,
  onClose
}: ErrorModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="cg-ra-modal-backdrop" role="presentation" onClick={onClose}>
          <motion.div
            className="cg-ra-feedback-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cg-ra-error-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <button
              type="button"
              className="cg-ra-modal-close-btn"
              onClick={onClose}
              aria-label="Close"
            >
              <IconX size={18} />
            </button>

            <div className="cg-ra-feedback-icon-wrap error">
              <motion.div
                initial={{ scale: 0.4, rotate: 20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
              >
                <IconX size={32} />
              </motion.div>
            </div>

            <h3 id="cg-ra-error-title" className="cg-ra-feedback-title">
              {title}
            </h3>
            <FeedbackDescription text={description} />

            <div className="cg-ra-feedback-actions">
              {onRetry ? (
                <div style={{ display: "flex", gap: "0.75rem", width: "100%" }}>
                  <button
                    type="button"
                    className="cg-ra-btn-secondary"
                    style={{ flex: 1 }}
                    onClick={onClose}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="cg-ra-btn-danger"
                    style={{ flex: 1 }}
                    onClick={() => {
                      onClose();
                      onRetry();
                    }}
                    autoFocus
                  >
                    {actionText}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="cg-ra-btn-danger full-width"
                  onClick={onClose}
                  autoFocus
                >
                  Close
                </button>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
