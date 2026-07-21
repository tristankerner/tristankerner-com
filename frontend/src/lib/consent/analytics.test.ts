import { beforeEach, describe, expect, it } from "vitest";
import { applyConsent } from "./analytics.ts";

describe("applyConsent", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    window.dataLayer = undefined;
    window.gtag = undefined;
    window.fbq = undefined;
    window._fbq = undefined;
  });

  it("loads nothing when every category is declined", () => {
    applyConsent({ analytics: false, marketing: false });

    expect(document.head.querySelectorAll("script")).toHaveLength(0);
    expect(window.gtag).toBeUndefined();
    expect(window.fbq).toBeUndefined();
  });

  it("injects the GA script and seeds gtag/dataLayer when analytics is granted", () => {
    applyConsent({ analytics: true, marketing: false });

    const script = document.head.querySelector<HTMLScriptElement>(
      "script[src*='googletagmanager.com/gtag/js']",
    );
    expect(script).not.toBeNull();
    expect(script?.src).toContain("id=G-XXXXXXXXXX");
    expect(window.gtag).toBeTypeOf("function");
    expect(window.dataLayer?.length).toBeGreaterThan(0);
  });

  it("only injects the GA script once across repeated calls", () => {
    applyConsent({ analytics: true, marketing: false });
    applyConsent({ analytics: true, marketing: false });

    expect(document.head.querySelectorAll("script[src*='googletagmanager.com']")).toHaveLength(1);
  });

  it("injects the Meta Pixel script and seeds fbq when marketing is granted", () => {
    applyConsent({ analytics: false, marketing: true });

    const script = document.head.querySelector<HTMLScriptElement>(
      "script[src*='connect.facebook.net']",
    );
    expect(script).not.toBeNull();
    expect(window.fbq).toBeTypeOf("function");
    expect(window._fbq).toBe(window.fbq);
    // init + track PageView both queue (no real fbevents.js runs in tests to
    // install callMethod).
    expect(window.fbq?.queue.length).toBe(2);
  });

  it("only injects the Meta Pixel script once across repeated calls", () => {
    applyConsent({ analytics: false, marketing: true });
    applyConsent({ analytics: false, marketing: true });

    expect(document.head.querySelectorAll("script[src*='connect.facebook.net']")).toHaveLength(1);
  });

  it("loads both trackers when both categories are granted", () => {
    applyConsent({ analytics: true, marketing: true });

    expect(document.head.querySelector("script[src*='googletagmanager.com']")).not.toBeNull();
    expect(document.head.querySelector("script[src*='connect.facebook.net']")).not.toBeNull();
  });
});
