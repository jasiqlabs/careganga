/**
 * CareGanga original Admin UI — semantic design tokens.
 * Derived from the unmodified 167-screen upload and original U05/U08 pixels.
 * Captured RGB samples are evidence, not a claim about the site's original CSS.
 * Visual/device/contrast checks remain a separate executed QA gate.
 *
 * Shared across Web and native Internal Android; do not fork per-module palettes.
 */
export const careGangaTheme = {
  sidebar:"#0A1F44",
  sidebarText:"#EFF4FF",
  sidebarMuted:"#BBCBE6",
  selectedNavigation:"#1E53DC",
  selectedNavigationText:"#FFFFFF",
  /** CG-01 selected card/tab background used by authenticated modules. */
  selectedSurface:"#EEF4FF",
  primary:"#1E53DC",
  primaryPressed:"#1748BE",
  primaryText:"#FFFFFF",
  background:"#F4F4F1",
  /** Authenticated Android CG-01 canvas. Public website/app retain their own visual contract. */
  adminCanvas:"#F8FAFC",
  surface:"#FFFFFF",
  text:"#16233B",
  mutedText:"#637084",
  border:"#E0E5ED",
  error:"#C43740",
  focus:"#1E53DC",
  modalBackdrop:"rgba(9, 17, 35, .52)"
} as const;

/** Exact sampled center pixels from the seven circles in original U08. */
export const roleColorOptions = [
  {key:"blue",name:"Blue",hex:"#1064CB"},
  {key:"green",name:"Green",hex:"#1BAF7A"},
  {key:"amber",name:"Amber",hex:"#EDA100"},
  {key:"orange",name:"Orange",hex:"#EB6834"},
  {key:"violet",name:"Violet",hex:"#4A3AA7"},
  {key:"pink",name:"Pink",hex:"#E87BA4"},
  {key:"teal",name:"Teal",hex:"#0E7490"}
] as const;
export type RoleColorKey = typeof roleColorOptions[number]["key"];
export function roleColor(key: string|null|undefined):string {
  return roleColorOptions.find(x=>x.key===key)?.hex??roleColorOptions[0].hex;
}

/** Human interaction semantics; do not invent exact animation duration from static images. */
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

/** Public patient-facing palette, aligned with the existing CareGanga public Web chrome and CMS. Not an Admin palette or a claim of exact original CSS. */
export const careGangaPublicTheme = {
  ...careGangaTheme,
  sidebar:"#112F2A", sidebarText:"#FFFFFF", sidebarMuted:"#D4E5DD",
  selectedNavigation:"#194A3A", selectedNavigationText:"#FFFFFF",
  selectedSurface:"#EAF4EE", primary:"#194A3A", primaryPressed:"#14362A",
  primaryText:"#FFFFFF", background:"#FFFCF5", surface:"#FFFFFF",
  text:"#14233A", mutedText:"#4D6072", border:"#BCCFC6", focus:"#167763",
  gold:"#ECC65B", amber:"#FFA337"
} as const;
