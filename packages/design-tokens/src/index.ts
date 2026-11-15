/**
 * Shared semantic token contract, intentionally without guessed brand HEX/typography/motion.
 * Original 167-image CareGanga audit is the visual authority for future approved exact values.
 * Web currently maps to OS/system semantics; native adapts to Android system semantics.
 * The visual parity gate remains VISUAL_NOT_RUN until screenshot assets are available.
 */
export const semanticTokenKeys = {
  surface:"cg.surface",
  text:"cg.text",
  selectedNavigation:"cg.navigation.selected",
  selectedNavigationText:"cg.navigation.selectedText",
  outline:"cg.outline",
  statusError:"cg.status.error",
  focus:"cg.focus",
  motionReduced:"cg.motion.reduce"
} as const;
export type SemanticTokenKey = typeof semanticTokenKeys[keyof typeof semanticTokenKeys];
