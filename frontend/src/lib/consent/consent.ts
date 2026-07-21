import { type ConsentCategories, consentState } from "./state.svelte.ts";
import { CONSENT_STORAGE_KEY } from "./config.ts";
import { applyConsent } from "./analytics.ts";

interface StoredConsent {
  categories: ConsentCategories;
}

function isConsentCategories(value: unknown): value is ConsentCategories {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ConsentCategories).analytics === "boolean" &&
    typeof (value as ConsentCategories).marketing === "boolean"
  );
}

function readStoredConsent(): StoredConsent | null {
  try {
    const raw = localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { categories?: unknown };
    return isConsentCategories(parsed.categories) ? { categories: parsed.categories } : null;
  } catch {
    return null;
  }
}

function persistConsent(categories: ConsentCategories) {
  try {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ categories } satisfies StoredConsent),
    );
  } catch {
    // Preference just won't survive a reload (e.g. private browsing); not fatal.
  }
}

function setConsent(categories: ConsentCategories) {
  consentState.categories = categories;
  consentState.status = "decided";
  persistConsent(categories);
  applyConsent(categories);
}

/** Reads any previously stored choice and re-applies it (e.g. on page load). */
export function initConsent() {
  const stored = readStoredConsent();
  if (!stored) return;
  consentState.categories = stored.categories;
  consentState.status = "decided";
  applyConsent(stored.categories);
}

export function acceptAll() {
  setConsent({ analytics: true, marketing: true });
}

export function declineAll() {
  setConsent({ analytics: false, marketing: false });
}

export function savePreferences(categories: ConsentCategories) {
  setConsent(categories);
}
