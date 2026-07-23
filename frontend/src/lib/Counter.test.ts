import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/svelte";
import { tick } from "svelte";

vi.mock("$app/state", () => ({
  page: { url: new URL("http://localhost/") },
}));

import { page } from "$app/state";
import Counter from "./Counter.svelte";
import { counterState, themeState } from "./state.svelte.ts";

function digitTitles(container: HTMLElement): (string | null)[] {
  return [...container.querySelectorAll("title")].map((t) => t.textContent);
}

describe("Counter", () => {
  it("renders one digit svg per character of the current page's count", () => {
    page.url = new URL("http://localhost/");
    counterState.pageCounts = [{ path: "/", total_unique_visitors: 42 }];

    const { container } = render(Counter);
    expect(digitTitles(container)).toEqual(["Zero", "Zero", "Zero", "Four", "Two"]);
  });

  it("uses the count for the current path when present", () => {
    page.url = new URL("http://localhost/blog");
    counterState.pageCounts = [
      { path: "/", total_unique_visitors: 1 },
      { path: "/blog", total_unique_visitors: 23 },
    ];

    const { container } = render(Counter);
    expect(digitTitles(container)).toEqual(["Zero", "Zero", "Zero", "Two", "Three"]);
  });

  it("falls back to the home page count when the current path has no entry", () => {
    page.url = new URL("http://localhost/about-me");
    counterState.pageCounts = [{ path: "/", total_unique_visitors: 7 }];

    const { container } = render(Counter);
    expect(digitTitles(container)).toEqual(["Zero", "Zero", "Zero", "Zero", "Seven"]);
  });

  it("defaults to 0 when there is no home count either", () => {
    page.url = new URL("http://localhost/about-me");
    counterState.pageCounts = [];

    const { container } = render(Counter);
    expect(digitTitles(container)).toEqual(["Zero", "Zero", "Zero", "Zero", "Zero"]);
  });

  it("uses light colors when not in dark mode", () => {
    page.url = new URL("http://localhost/");
    counterState.pageCounts = [{ path: "/", total_unique_visitors: 1 }];
    themeState.darkMode = false;

    const { container } = render(Counter);
    expect(container.querySelector("rect")?.getAttribute("fill")).toBe("#FFFFFF");
  });

  it("uses dark colors in dark mode", () => {
    page.url = new URL("http://localhost/");
    counterState.pageCounts = [{ path: "/", total_unique_visitors: 1 }];
    themeState.darkMode = true;

    const { container } = render(Counter);
    expect(container.querySelector("rect")?.getAttribute("fill")).toBe("#000000");

    themeState.darkMode = false;
  });

  it("applies the class prop to the wrapping div", () => {
    page.url = new URL("http://localhost/");
    counterState.pageCounts = [{ path: "/", total_unique_visitors: 1 }];

    const { container } = render(Counter, { props: { class: "my-counter-class" } });
    expect(container.querySelector(".my-counter-class")).toBeTruthy();
  });

  it("re-keys and re-renders a digit when the count changes after mount", async () => {
    page.url = new URL("http://localhost/");
    counterState.pageCounts = [{ path: "/", total_unique_visitors: 1 }];

    const { container } = render(Counter);
    expect(digitTitles(container)).toEqual(["Zero", "Zero", "Zero", "Zero", "One"]);

    counterState.pageCounts = [{ path: "/", total_unique_visitors: 2 }];
    await tick();

    // The old digit's out:fly transition keeps it mounted during its
    // animation (which jsdom can't faithfully time via the Web Animations
    // API), so just confirm the new digit mounted rather than asserting the
    // old one has already been removed.
    expect(digitTitles(container)).toContain("Two");
  });
});
