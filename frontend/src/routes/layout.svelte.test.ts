import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { createRawSnippet } from "svelte";

vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/blog") },
}));

const { connectCounterSocket } = vi.hoisted(() => ({ connectCounterSocket: vi.fn() }));
vi.mock("../lib/counterSocket.ts", () => ({ connectCounterSocket }));

import Layout from "./+layout.svelte";
import { themeState } from "../lib/state.svelte.ts";

function children(text = "child content") {
  return createRawSnippet(() => ({
    render: () => `<div data-testid="layout-child">${text}</div>`,
  }));
}

describe("root layout", () => {
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
});
