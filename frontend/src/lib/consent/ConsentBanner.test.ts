import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { tick } from "svelte";

// FACEBOOK_PIXEL_ID has no placeholder fallback (see config.ts), so a real
// value is stubbed here to exercise the normal "pixel loads" path - the
// "no ID configured" case is covered directly in analytics.test.ts.
vi.mock("./config.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./config.ts")>()),
  FACEBOOK_PIXEL_ID: "123456789012345",
}));

import { CONSENT_STORAGE_KEY } from "./config.ts";
import { consentState } from "./state.svelte.ts";
import ConsentBanner from "./ConsentBanner.svelte";

describe("ConsentBanner", () => {
  beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = "";
    window.dataLayer = undefined;
    window.gtag = undefined;
    window.fbq = undefined;
    window._fbq = undefined;
    consentState.status = "pending";
    consentState.categories = { analytics: true, marketing: true };
  });

  it("shows Accept All, Decline, and Customize when nothing is stored", () => {
    render(ConsentBanner);

    expect(screen.getByRole("button", { name: "Accept All" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Decline" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Customize" })).toBeInTheDocument();
  });

  it("accepting all hides the banner, loads both trackers, and persists the choice", async () => {
    render(ConsentBanner);

    await fireEvent.click(screen.getByRole("button", { name: "Accept All" }));

    expect(consentState.status).toBe("decided");
    expect(consentState.categories).toEqual({ analytics: true, marketing: true });
    expect(screen.queryByRole("button", { name: "Accept All" })).not.toBeInTheDocument();
    expect(document.head.querySelector("script[src*='googletagmanager.com']")).not.toBeNull();
    expect(document.head.querySelector("script[src*='connect.facebook.net']")).not.toBeNull();

    const stored = JSON.parse(localStorage.getItem(CONSENT_STORAGE_KEY) ?? "null");
    expect(stored.categories).toEqual({ analytics: true, marketing: true });
  });

  it("declining hides the banner and loads no trackers", async () => {
    render(ConsentBanner);

    await fireEvent.click(screen.getByRole("button", { name: "Decline" }));

    expect(consentState.status).toBe("decided");
    expect(consentState.categories).toEqual({ analytics: false, marketing: false });
    expect(document.head.querySelectorAll("script")).toHaveLength(0);
  });

  it("opens the preferences modal from the banner's Customize button", async () => {
    render(ConsentBanner);

    await fireEvent.click(screen.getByRole("button", { name: "Customize" }));

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Cookie preferences")).toBeInTheDocument();
    expect(dialog.getByText("Necessary")).toBeInTheDocument();
    expect(dialog.getByText("Analytics")).toBeInTheDocument();
    expect(dialog.getByText("Marketing")).toBeInTheDocument();

    const checkboxes = dialog.getAllByRole("checkbox");
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[0]).toBeDisabled();
  });

  it("saving custom preferences persists only the granted categories", async () => {
    render(ConsentBanner);

    await fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    const dialog = within(screen.getByRole("dialog"));
    const [, analyticsToggle] = dialog.getAllByRole("checkbox");
    await fireEvent.click(analyticsToggle); // turn analytics off, leave marketing on

    await fireEvent.click(dialog.getByRole("button", { name: "Save preferences" }));

    expect(consentState.status).toBe("decided");
    expect(consentState.categories).toEqual({ analytics: false, marketing: true });
    expect(document.head.querySelector("script[src*='googletagmanager.com']")).toBeNull();
    expect(document.head.querySelector("script[src*='connect.facebook.net']")).not.toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("Accept All inside the preferences modal grants both categories regardless of toggles", async () => {
    render(ConsentBanner);

    await fireEvent.click(screen.getByRole("button", { name: "Customize" }));
    const dialog = within(screen.getByRole("dialog"));
    const [, analyticsToggle, marketingToggle] = dialog.getAllByRole("checkbox");
    await fireEvent.click(analyticsToggle);
    await fireEvent.click(marketingToggle);

    await fireEvent.click(dialog.getByRole("button", { name: "Accept All" }));

    expect(consentState.categories).toEqual({ analytics: true, marketing: true });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("exposes openPreferences so callers outside the component (e.g. a footer link) can reopen it, seeded from a prior decline", async () => {
    const { component } = render(ConsentBanner);

    await fireEvent.click(screen.getByRole("button", { name: "Decline" }));
    component.openPreferences();
    await tick();

    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getByText("Cookie preferences")).toBeInTheDocument();
    const [, analyticsToggle, marketingToggle] = dialog.getAllByRole("checkbox");
    expect(analyticsToggle).not.toBeChecked();
    expect(marketingToggle).not.toBeChecked();
  });

  it("restores a previously stored decision on mount without showing the banner", () => {
    localStorage.setItem(
      CONSENT_STORAGE_KEY,
      JSON.stringify({ categories: { analytics: true, marketing: false } }),
    );

    render(ConsentBanner);

    expect(consentState.status).toBe("decided");
    expect(screen.queryByRole("button", { name: "Accept All" })).not.toBeInTheDocument();
    expect(document.head.querySelector("script[src*='googletagmanager.com']")).not.toBeNull();
  });
});
