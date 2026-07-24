import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";

vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/blog") },
}));

const { connectCounterSocket } = vi.hoisted(() => ({ connectCounterSocket: vi.fn() }));
vi.mock("../lib/counterSocket.ts", () => ({ connectCounterSocket }));

const { trackPageView } = vi.hoisted(() => ({ trackPageView: vi.fn() }));
vi.mock("../lib/consent/analytics.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/consent/analytics.ts")>()),
  trackPageView,
}));

const { afterNavigate } = vi.hoisted(() => ({ afterNavigate: vi.fn() }));
vi.mock("$app/navigation", () => ({ afterNavigate }));

import Layout from "./+layout.svelte";
import { themeState } from "../lib/state.svelte.ts";
import { consentState } from "../lib/consent/state.svelte.ts";
import { GTAG_SCRIPT_SRC } from "../lib/consent/gtagBootstrap.ts";

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

  it("always renders the gtag bootstrap in <head>, regardless of consent status", () => {
    document.head.innerHTML = "";

    render(Layout, { props: { children: children() } });

    expect(document.head.querySelector(`script[src="${GTAG_SCRIPT_SRC}"]`)).not.toBeNull();
    const inlineScripts = Array.from(document.head.querySelectorAll("script:not([src])"));
    expect(inlineScripts.some((script) => script.textContent?.includes("consent"))).toBe(true);
  });

  it("reports client-side navigations to trackPageView, skipping the initial 'enter' load", () => {
    trackPageView.mockClear();
    afterNavigate.mockClear();

    render(Layout, { props: { children: children() } });

    const onNavigate = afterNavigate.mock.calls[0][0];
    onNavigate({ type: "enter" });
    expect(trackPageView).not.toHaveBeenCalled();

    onNavigate({ type: "link" });
    expect(trackPageView).toHaveBeenCalledWith("/blog");
  });
});
