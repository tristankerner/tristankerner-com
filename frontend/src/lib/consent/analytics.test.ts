import { beforeEach, describe, expect, it, vi } from "vitest";

// FACEBOOK_PIXEL_ID has no placeholder fallback (see config.ts) - unlike
// GOOGLE_ANALYTICS_ID, tests need to opt in to a configured ID to exercise
// the "pixel loads" path, and can leave it unset to exercise the "pixel
// isn't configured yet" path that's the real default in this environment.
const configMock = vi.hoisted(() => ({ facebookPixelId: undefined as string | undefined }));
vi.mock("./config.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./config.ts")>()),
  get FACEBOOK_PIXEL_ID() {
    return configMock.facebookPixelId;
  },
}));

import { applyConsent, trackPageView } from "./analytics.ts";

describe("applyConsent", () => {
  beforeEach(() => {
    document.head.innerHTML = "";
    window.dataLayer = undefined;
    window.gtag = undefined;
    window.fbq = undefined;
    window._fbq = undefined;
    configMock.facebookPixelId = undefined;
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

  it("injects the Meta Pixel script and seeds fbq when marketing is granted and a pixel ID is configured", () => {
    configMock.facebookPixelId = "123456789012345";

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
    configMock.facebookPixelId = "123456789012345";

    applyConsent({ analytics: false, marketing: true });
    applyConsent({ analytics: false, marketing: true });

    expect(document.head.querySelectorAll("script[src*='connect.facebook.net']")).toHaveLength(1);
  });

  it("loads both trackers when both categories are granted and a pixel ID is configured", () => {
    configMock.facebookPixelId = "123456789012345";

    applyConsent({ analytics: true, marketing: true });

    expect(document.head.querySelector("script[src*='googletagmanager.com']")).not.toBeNull();
    expect(document.head.querySelector("script[src*='connect.facebook.net']")).not.toBeNull();
  });

  it("does not load the Meta Pixel when marketing is granted but no pixel ID is configured", () => {
    configMock.facebookPixelId = undefined;

    applyConsent({ analytics: false, marketing: true });

    expect(document.head.querySelectorAll("script[src*='connect.facebook.net']")).toHaveLength(0);
    expect(window.fbq).toBeUndefined();
  });

  it("does not load the Meta Pixel when the configured pixel ID is blank", () => {
    configMock.facebookPixelId = "";

    applyConsent({ analytics: false, marketing: true });

    expect(document.head.querySelectorAll("script[src*='connect.facebook.net']")).toHaveLength(0);
    expect(window.fbq).toBeUndefined();
  });
});

describe("trackPageView", () => {
  beforeEach(() => {
    window.gtag = undefined;
    window.fbq = undefined;
  });

  it("sends a gtag page_view event with the given path", () => {
    const gtag = vi.fn();
    window.gtag = gtag;

    trackPageView("/blog");

    expect(gtag).toHaveBeenCalledWith("event", "page_view", {
      page_path: "/blog",
      page_location: window.location.href,
      page_title: document.title,
    });
  });

  it("sends an fbq PageView track call", () => {
    const fbq = vi.fn() as unknown as Window["fbq"];
    window.fbq = fbq;

    trackPageView("/blog");

    expect(fbq).toHaveBeenCalledWith("track", "PageView");
  });

  it("does nothing when neither tracker has been loaded", () => {
    expect(() => trackPageView("/blog")).not.toThrow();
  });
});
