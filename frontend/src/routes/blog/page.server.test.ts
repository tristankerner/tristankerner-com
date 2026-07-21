import { describe, expect, it } from "vitest";
import { paginate, totalPages } from "$lib/blog/posts";
import { load, prerender } from "./+page.server.ts";

describe("blog index route", () => {
  it("prerenders", () => {
    expect(prerender).toBe(true);
  });

  it("returns page 1 of posts", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = load({} as any);
    expect(result).toEqual({
      posts: paginate(1),
      currentPage: 1,
      totalPages: totalPages(),
    });
  });
});
