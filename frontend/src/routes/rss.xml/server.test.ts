import { describe, expect, it } from "vitest";
import { SITE_URL } from "$lib/blog/config";
import { posts } from "$lib/blog/posts";
import { GET, prerender } from "./+server.ts";

describe("GET /rss.xml", () => {
  it("prerenders", () => {
    expect(prerender).toBe(true);
  });

  it("returns an RSS feed with the right content type", () => {
    const res = GET();
    expect(res.headers.get("content-type")).toBe("application/rss+xml");
  });

  it("includes the feed shell", async () => {
    const text = await GET().text();
    expect(text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(text).toContain('<rss version="2.0"');
    expect(text).toContain(`<atom:link href="${SITE_URL}/rss.xml" rel="self"`);
  });

  it("includes an item for every post", async () => {
    const text = await GET().text();
    for (const post of posts) {
      const permalink = `${SITE_URL}/blog/${post.date}/${post.slug}`;
      expect(text).toContain(`<link>${permalink}</link>`);
      expect(text).toContain(`<guid isPermaLink="true">${permalink}</guid>`);
      expect(text).toContain(post.metadata.title);
    }
  });
});
