import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { IconChevronLeft, IconChevronRight } from "./registration-approvals-icons";

export interface ApprovalPaginationProps {
  currentPage: number;
  totalRecords: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function ApprovalPagination({
  currentPage,
  totalRecords,
  pageSize,
  onPageChange
}: ApprovalPaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalRecords / pageSize));

  if (totalRecords <= 0) return null;

  const startRecord = (currentPage - 1) * pageSize + 1;
  const endRecord = Math.min(currentPage * pageSize, totalRecords);

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        pages.push(1, 2, 3, 4, "...", totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
      }
    }
    return pages;
  };

  return (
    <View style={styles.container}>
      {/* Range Info */}
      <Text style={styles.infoText}>
        Showing <Text style={styles.boldText}>{startRecord}</Text> to{" "}
        <Text style={styles.boldText}>{endRecord}</Text> of{" "}
        <Text style={styles.boldText}>{totalRecords}</Text> applications
      </Text>

      {/* Page Buttons Row */}
      <View style={styles.controlsRow}>
        {/* Previous Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Previous page"
          disabled={currentPage <= 1}
          onPress={() => onPageChange(currentPage - 1)}
          style={({ pressed }) => [
            styles.navBtn,
            currentPage <= 1 && styles.disabledBtn,
            pressed && styles.btnPressed
          ]}
        >
          <IconChevronLeft size={16} color={currentPage <= 1 ? "#CBD5E1" : "#1E293B"} />
        </Pressable>

        {/* Page Numbers */}
        <View style={styles.pageNumbersWrap}>
          {getPageNumbers().map((p, idx) => {
            if (p === "...") {
              return (
                <Text key={`ellipsis-${idx}`} style={styles.ellipsisText}>
                  …
                </Text>
              );
            }
            const isCurrent = p === currentPage;
            return (
              <Pressable
                key={p}
                accessibilityRole="button"
                accessibilityLabel={`Page ${p}`}
                accessibilityState={{ selected: isCurrent }}
                onPress={() => onPageChange(Number(p))}
                style={({ pressed }) => [
                  styles.pageNumberBtn,
                  isCurrent && styles.activePageBtn,
                  pressed && styles.btnPressed
                ]}
              >
                <Text
                  style={[
                    styles.pageNumberText,
                    isCurrent && styles.activePageNumberText
                  ]}
                >
                  {p}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Next Button */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Next page"
          disabled={currentPage >= totalPages}
          onPress={() => onPageChange(currentPage + 1)}
          style={({ pressed }) => [
            styles.navBtn,
            currentPage >= totalPages && styles.disabledBtn,
            pressed && styles.btnPressed
          ]}
        >
          <IconChevronRight
            size={16}
            color={currentPage >= totalPages ? "#CBD5E1" : "#1E293B"}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    alignItems: "center",
    gap: 10
  },
  infoText: {
    fontSize: 12,
    color: "#64748B"
  },
  boldText: {
    fontWeight: "700",
    color: "#0F172A"
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  disabledBtn: {
    borderColor: "#F1F5F9",
    backgroundColor: "#F8FAFC"
  },
  pageNumbersWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4
  },
  pageNumberBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center"
  },
  activePageBtn: {
    backgroundColor: "#16A34A",
    borderColor: "#16A34A"
  },
  pageNumberText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#334155"
  },
  activePageNumberText: {
    color: "#FFFFFF",
    fontWeight: "700"
  },
  ellipsisText: {
    fontSize: 14,
    color: "#94A3B8",
    paddingHorizontal: 2
  },
  btnPressed: {
    opacity: 0.75
  }
});
