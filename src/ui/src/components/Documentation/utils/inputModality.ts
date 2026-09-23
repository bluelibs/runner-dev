/**
 * Which input device last drove the docs UI. Tables open search-first for
 * pointer users, but keyboard navigation (`g` chains, the palette, Escape
 * back to a list) must leave focus on the page: the global shortcut layer
 * ignores keys typed into inputs, so an autofocused search would swallow
 * the next shortcut. Recorded by useGlobalShortcuts, which already observes
 * every keydown app-wide.
 */
export type InputModality = "keyboard" | "pointer";

let lastInputModality: InputModality | null = null;

export function recordInputModality(modality: InputModality): void {
  lastInputModality = modality;
}

export function getLastInputModality(): InputModality | null {
  return lastInputModality;
}

/**
 * Search-first unless the keyboard is driving. With no signal yet (a fresh
 * page load) the table keeps its search-first default.
 */
export function shouldAutofocusTableSearch(
  modality: InputModality | null
): boolean {
  return modality !== "keyboard";
}
