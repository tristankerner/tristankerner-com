import { describe, expect, it } from "vitest";
import { prerender } from "./+layout.ts";

describe("root layout config", () => {
  it("prerenders", () => {
    expect(prerender).toBe(true);
  });
});
