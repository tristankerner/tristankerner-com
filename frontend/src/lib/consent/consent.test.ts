import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// FACEBOOK_PIXEL_ID has no placeholder fallback (see config.ts), so a real
// value is stubbed here to exercise the normal "pixel loads" path - the
// "no ID configured" case is covered directly in analytics.test.ts.
vi.mock("./config.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./config.ts")>()),
  FACEBOOK_PIXEL_ID: "123456789012345",
}));

import { CONSENT_STORAGE_KEY } from "./config.ts";
import { consentState } from "./state.svelte.ts";
import { acceptAll, declineAll, initConsent, savePreferences } from "./consent.ts";

describe("consent", () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = "";
    window.gtag = vi.fn();
    consentState.status = "pending";
    consentState.categories = { analytics: true, marketing: true };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays pending when nothing is stored", () => {
    initConsent();
    expect(consentState.status).toBe("pending");
  });

  it("acceptAll grants both categories, persists them, and loads both trackers", () => {
    acceptAll();

    expect(consentState.status).toBe("decided");
    expect(consentState.categories).toEqual({ analytics: true, marketing: true });
    expect(window.gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
    });
    expect(document.head.querySelector("script[src*='connect.facebook.net']")).not.toBeNull();

    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) ?? "null");
    expect(stored.categories).toEqual({ analytics: true, marketing: true });
  });

  it("declineAll declines both categories and loads no trackers", () => {
    declineAll();

    expect(consentState.status).toBe("decided");
    expect(consentState.categories).toEqual({ analytics: false, marketing: false });
    expect(window.gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "denied",
    });
    expect(document.head.querySelectorAll("script")).toHaveLength(0);
  });

  it("savePreferences persists a custom mix of categories", () => {
    savePreferences({ analytics: true, marketing: false });

    expect(consentState.categories).toEqual({ analytics: true, marketing: false });
    expect(window.gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
    });
    expect(document.head.querySelector("script[src*='connect.facebook.net']")).toBeNull();
  });

  it("initConsent restores and re-applies a previously stored choice", () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ categories: { analytics: true, marketing: false } }),
    );

    initConsent();

    expect(consentState.status).toBe("decided");
    expect(consentState.categories).toEqual({ analytics: true, marketing: false });
    expect(window.gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
    });
    expect(document.head.querySelector("script[src*='connect.facebook.net']")).toBeNull();
  });

  it("ignores unparseable stored consent", () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, "not json");
    initConsent();
    expect(consentState.status).toBe("pending");
  });

  it("ignores stored consent missing the expected shape", () => {
    localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify({ categories: { analytics: true } }));
    initConsent();
    expect(consentState.status).toBe("pending");
  });

  it("swallows a localStorage write failure instead of throwing", () => {
    vi.spyOn(localStorage, "setItem").mockImplementation(() => {
      throw new Error("quota exceeded");
    });

    expect(() => acceptAll()).not.toThrow();
    expect(consentState.status).toBe("decided");
  });
});
