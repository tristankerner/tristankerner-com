import { describe, expect, it } from "vitest";
import { counterState, themeState } from "./state.svelte.ts";

describe("themeState", () => {
  it("defaults to light mode", () => {
    expect(themeState.darkMode).toBe(false);
  });

  it("is mutable", () => {
    themeState.darkMode = true;
    expect(themeState.darkMode).toBe(true);
    themeState.darkMode = false;
  });
});

describe("counterState", () => {
  it("starts in a loading state with no error", () => {
    expect(counterState.loading).toBe(true);
    expect(counterState.completedOnce).toBe(false);
    expect(counterState.error).toBe(false);
    expect(counterState.errorMessage).toBeNull();
  });

  it("seeds pageCounts with the home page at zero visitors", () => {
    expect(counterState.pageCounts).toEqual([{ path: "/", total_unique_visitors: 0 }]);
  });
});
