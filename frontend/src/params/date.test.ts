import { describe, expect, it } from "vitest";
import { match } from "./date";

describe("date param matcher", () => {
  it("matches a well-formed YYYY-MM-DD date", () => {
    expect(match("2026-07-10")).toBe(true);
  });

  it("rejects a non-date slug", () => {
    expect(match("hello-blog")).toBe(false);
  });

  it("rejects a partial date", () => {
    expect(match("2026-07")).toBe(false);
  });

  it("rejects a date with extra trailing characters", () => {
    expect(match("2026-07-10-extra")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(match("")).toBe(false);
  });
});
