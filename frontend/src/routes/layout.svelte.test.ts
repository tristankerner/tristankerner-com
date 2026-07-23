import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";
import type { AfterNavigate } from "@sveltejs/kit";

vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/blog?foo=bar") },
}));

const { connectCounterSocket } = vi.hoisted(() => ({ connectCounterSocket: vi.fn() }));
vi.mock("../lib/counterSocket.ts", () => ({ connectCounterSocket }));

const { afterNavigateCallback } = vi.hoisted(() => ({
  afterNavigateCallback: { current: undefined as ((navigation: AfterNavigate) => void) | undefined },
}));
vi.mock("$app/navigation", () => ({
  afterNavigate: (callback: (navigation: AfterNavigate) => void) => {
    afterNavigateCallback.current = callback;
  },
}));

// consent.ts imports applyConsent from this same module via a relative path,
// so the mock must preserve the real exports (importOriginal) - replacing
// the whole module would silently break ConsentBanner's consent flow too.
const { trackPageView } = vi.hoisted(() => ({ trackPageView: vi.fn() }));
vi.mock("$lib/consent/analytics.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/consent/analytics.ts")>()),
  trackPageView,
}));

import Layout from "./+layout.svelte";
import { themeState } from "../lib/state.svelte.ts";
import { consentState } from "../lib/consent/state.svelte.ts";

function navigate(type: AfterNavigate["type"]) {
  afterNavigateCallback.current?.({ type } as AfterNavigate);
}

function children(text = "child content") {
  return createRawSnippet(() => ({
    render: () => `<div data-testid="layout-child">${text}</div>`,
  }));
}

describe("root layout", () => {
  beforeEach(() => {
    localStorage.clear();
    consentState.status = "pending";
    consentState.categories = { analytics: true, marketing: true };
    trackPageView.mockClear();
    afterNavigateCallback.current = undefined;
  });

  it("renders the nav, footer, and slotted page content", () => {
    render(Layout, { props: { children: children() } });

    expect(screen.getByText("Tristan Kerner")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Blog" })).toHaveAttribute("href", "/blog");
    expect(screen.getByTestId("layout-child")).toHaveTextContent("child content");
  });

  it("connects the visitor counter socket on mount", () => {
    connectCounterSocket.mockClear();
    render(Layout, { props: { children: children() } });
    expect(connectCounterSocket).toHaveBeenCalledTimes(1);
  });

  it("syncs themeState with the dark class on <html>", async () => {
    document.documentElement.classList.remove("dark");
    themeState.darkMode = false;

    render(Layout, { props: { children: children() } });
    expect(themeState.darkMode).toBe(false);

    document.documentElement.classList.add("dark");
    await vi.waitFor(() => expect(themeState.darkMode).toBe(true));

    document.documentElement.classList.remove("dark");
  });

  it("ignores mutations of attributes other than class", async () => {
    document.documentElement.classList.remove("dark");
    themeState.darkMode = false;

    render(Layout, { props: { children: children() } });

    document.documentElement.setAttribute("lang", "fr");
    // Give any (unwanted) MutationObserver reaction a chance to run before
    // asserting it didn't - there's nothing to await otherwise, since success
    // here means nothing happens.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(themeState.darkMode).toBe(false);
    document.documentElement.removeAttribute("lang");
  });

  it("opens the cookie preferences modal from the footer's Cookie settings link", async () => {
    render(Layout, { props: { children: children() } });

    await fireEvent.click(screen.getByRole("button", { name: "Cookie settings" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Cookie preferences")).toBeInTheDocument();
  });

  it("does not track a page view for the initial 'enter' navigation", () => {
    render(Layout, { props: { children: children() } });

    navigate("enter");

    expect(trackPageView).not.toHaveBeenCalled();
  });

  it("tracks a page view for a client-side navigation, using the current path and query", () => {
    render(Layout, { props: { children: children() } });

    navigate("link");

    expect(trackPageView).toHaveBeenCalledExactlyOnceWith("/blog?foo=bar");
  });

  it("tracks a page view for back/forward navigation", () => {
    render(Layout, { props: { children: children() } });

    navigate("popstate");

    expect(trackPageView).toHaveBeenCalledExactlyOnceWith("/blog?foo=bar");
  });
});
