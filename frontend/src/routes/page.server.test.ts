import { describe, expect, it } from "vitest";
import { paginate, posts } from "$lib/blog/posts";
import { load, prerender } from "./+page.server.ts";

describe("home route", () => {
  it("prerenders", () => {
    expect(prerender).toBe(true);
  });

  it("returns the 3 most recent posts and whether more exist", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = load({} as any);
    expect(result).toEqual({
      recentPosts: paginate(1).slice(0, 3),
      hasMorePosts: posts.length > 3,
    });
  });
});
