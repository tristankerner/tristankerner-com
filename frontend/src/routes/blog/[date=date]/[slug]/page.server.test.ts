import { describe, expect, it } from "vitest";
import { isHttpError } from "@sveltejs/kit";
import { componentPathFor, posts } from "$lib/blog/posts";
import { entries, load, prerender } from "./+page.server.ts";

describe("blog post route", () => {
  it("prerenders", () => {
    expect(prerender).toBe(true);
  });

  it("generates an entry for every post", () => {
    expect(entries()).toEqual(posts.map((post) => ({ date: post.date, slug: post.slug })));
  });

  it("loads a real post by date and slug", () => {
    const post = posts[0];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = load({ params: { date: post.date, slug: post.slug } } as any);
    expect(result).toEqual({ post, componentPath: componentPathFor(post) });
  });

  it("404s for an unknown post", () => {
    try {
      load({ params: { date: "1999-01-01", slug: "does-not-exist" } } as any);
      throw new Error("expected a 404");
    } catch (e) {
      expect(isHttpError(e, 404)).toBe(true);
    }
  });
});
