import { describe, expect, it } from "vitest";
import { consentState } from "./state.svelte.ts";

describe("consentState", () => {
  it("starts pending and opted-in by default", () => {
    expect(consentState.status).toBe("pending");
    expect(consentState.categories).toEqual({ analytics: true, marketing: true });
  });

  it("is mutable", () => {
    consentState.status = "decided";
    expect(consentState.status).toBe("decided");
    consentState.status = "pending";
  });
});
