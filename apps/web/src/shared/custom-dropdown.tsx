"use client";
import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export type DropdownOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

export type CustomDropdownProps = {
  id?: string;
  label?: string;
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  width?: string | number;
};

export function CustomDropdown({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = "Select...",
  disabled = false,
  className = "",
  width,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (option: DropdownOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  return (
    <div
      ref={dropdownRef}
      className={`cg-custom-dropdown-root ${className}`}
      style={{
        position: "relative",
        width: width ? width : "100%",
        display: "flex",
        flexDirection: "column",
        gap: "0.3rem",
      }}
    >
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "#64748b",
            userSelect: "none",
          }}
        >
          {label}
        </label>
      )}

      {/* Trigger Button */}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
          background: disabled ? "#f8fafc" : "#ffffff",
          border: isOpen ? "1px solid #4f46e5" : "1px solid #d1d5db",
          borderRadius: "8px",
          padding: "0.5rem 0.75rem",
          fontSize: "0.825rem",
          color: selectedOption ? "#1e293b" : "#94a3b8",
          fontWeight: 500,
          cursor: disabled ? "not-allowed" : "pointer",
          outline: "none",
          boxShadow: isOpen ? "0 0 0 3px rgba(79, 70, 229, 0.12)" : "none",
          transition: "all 0.15s ease-in-out",
          boxBox: "border-box",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {selectedOption?.icon && <span>{selectedOption.icon}</span>}
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <ChevronDown
          size={12}
          strokeWidth={1.8}
          style={{
            width: "12px",
            height: "12px",
            minWidth: "12px",
            minHeight: "12px",
            color: "#94a3b8",
            flexShrink: 0,
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease-in-out",
          }}
        />
      </button>

      {/* Floating Menu Popover */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            left: 0,
            width: "100%",
            minWidth: "160px",
            background: "#ffffff",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            boxShadow:
              "0 10px 25px -5px rgba(15, 23, 42, 0.12), 0 8px 10px -6px rgba(15, 23, 42, 0.05)",
            padding: "0.35rem",
            maxHeight: "220px",
            overflowY: "auto",
            zIndex: 100,
            boxSizing: "border-box",
            animation: "cg-dropdown-fade 0.12s ease-out",
          }}
        >
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <div
                key={option.value}
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.5rem",
                  padding: "0.45rem 0.65rem",
                  borderRadius: "6px",
                  fontSize: "0.825rem",
                  fontWeight: isSelected ? 600 : 500,
                  color: option.disabled
                    ? "#94a3b8"
                    : isSelected
                    ? "#4338ca"
                    : "#1e293b",
                  background: isSelected ? "#eef2ff" : "transparent",
                  cursor: option.disabled ? "not-allowed" : "pointer",
                  transition: "background 0.1s ease",
                  userSelect: "none",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected && !option.disabled) {
                    (e.currentTarget as HTMLElement).style.background = "#f8fafc";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected && !option.disabled) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                  }
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {option.icon && <span>{option.icon}</span>}
                  {option.label}
                </span>

                {isSelected && (
                  <Check className="w-3.5 h-3.5 text-indigo-600" style={{ flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
