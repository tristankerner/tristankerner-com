import { beforeEach, describe, expect, it } from "vitest";
import { GTAG_BOOTSTRAP_SCRIPT, GTAG_SCRIPT_SRC } from "./gtagBootstrap.ts";

describe("gtagBootstrap", () => {
  beforeEach(() => {
    window.dataLayer = undefined;
    window.gtag = undefined;
  });

  it("points the gtag.js loader at the configured measurement ID", () => {
    expect(GTAG_SCRIPT_SRC).toBe("https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX");
  });

  it("denies every consent type by default and configures the same measurement ID", () => {
    // Executed for real (rather than just string-matched) so a typo in the
    // template literal above would actually fail this test.
    new Function(GTAG_BOOTSTRAP_SCRIPT)();

    expect(window.gtag).toBeTypeOf("function");
    // Matches gtag.js's own documented snippet: gtag() queues the raw
    // `arguments` object (array-like, not a real array), so normalize each
    // entry before comparing.
    const calls = (window.dataLayer ?? []).map((entry) => Array.from(entry as ArrayLike<unknown>));
    expect(calls).toEqual([
      [
        "consent",
        "default",
        {
          ad_storage: "denied",
          ad_user_data: "denied",
          ad_personalization: "denied",
          analytics_storage: "denied",
          wait_for_update: 500,
        },
      ],
      ["js", expect.any(Date)],
      ["config", "G-XXXXXXXXXX"],
    ]);
  });
});
