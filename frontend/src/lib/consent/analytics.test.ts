import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyConsent, trackPageView } from "./analytics.ts";

describe("applyConsent", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    window.dataLayer = undefined;
    window.gtag = undefined;
    window.fbq = undefined;
    window._fbq = undefined;
  });

  it("does nothing to the Google tag when window.gtag isn't installed yet", () => {
    // The gtag bootstrap (see gtagBootstrap.ts) always runs before app code
    // in production, but isn't present in this unit test's jsdom document -
    // applyConsent must not throw when window.gtag is missing.
    expect(() => applyConsent({ analytics: true, marketing: false })).not.toThrow();
  });

  it("reports denied analytics_storage when analytics is declined", () => {
    window.gtag = vi.fn();

    applyConsent({ analytics: false, marketing: false });

    expect(window.gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "denied",
    });
    expect(window.fbq).toBeUndefined();
  });

  it("reports granted analytics_storage when analytics is accepted", () => {
    window.gtag = vi.fn();

    applyConsent({ analytics: true, marketing: false });

    expect(window.gtag).toHaveBeenCalledWith("consent", "update", {
      analytics_storage: "granted",
    });
  });

  it("skips the Meta Pixel when marketing is granted but no pixel ID is configured", () => {
    // This file doesn't mock ./config.ts, so FACEBOOK_PIXEL_ID is undefined
    // here (see config.ts) - the "loads a configured pixel" happy path is
    // covered where a real ID is mocked in (consent.test.ts,
    // ConsentBanner.test.ts).
    applyConsent({ analytics: false, marketing: true });

    expect(document.head.querySelectorAll("script")).toHaveLength(0);
    expect(window.fbq).toBeUndefined();
  });
});

describe("trackPageView", () => {
  beforeEach(() => {
    window.gtag = undefined;
    window.fbq = undefined;
  });

  it("does nothing when neither tracker is installed", () => {
    expect(() => trackPageView("/blog")).not.toThrow();
  });

  it("reports the page to gtag when it's installed", () => {
    window.gtag = vi.fn();

    trackPageView("/blog");

    expect(window.gtag).toHaveBeenCalledWith("event", "page_view", {
      page_path: "/blog",
      page_location: window.location.href,
      page_title: document.title,
    });
  });

  it("reports the page to fbq when it's installed", () => {
    const fbq = vi.fn();
    window.fbq = fbq as unknown as NonNullable<typeof window.fbq>;

    trackPageView("/blog");

    expect(fbq).toHaveBeenCalledWith("track", "PageView");
  });
});
