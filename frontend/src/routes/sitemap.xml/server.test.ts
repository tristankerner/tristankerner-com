import { describe, expect, it } from "vitest";
import { SITE_URL } from "$lib/blog/config";
import { posts, totalPages } from "$lib/blog/posts";
import { GET, prerender } from "./+server.ts";

describe("GET /sitemap.xml", () => {
  it("prerenders", () => {
    expect(prerender).toBe(true);
  });

  it("returns XML", async () => {
    const res = GET();
    expect(res.headers.get("content-type")).toBe("application/xml");
    const text = await res.text();
    expect(text).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(text).toContain("<urlset");
  });

  it("includes the static top-level paths", async () => {
    const text = await GET().text();
    for (const path of ["/", "/about-me", "/memory-lane", "/blog"]) {
      expect(text).toContain(`<url><loc>${SITE_URL}${path}</loc></url>`);
    }
  });

  it("includes a lastmod entry for every post", async () => {
    const text = await GET().text();
    for (const post of posts) {
      expect(text).toContain(
        `<url><loc>${SITE_URL}/blog/${post.date}/${post.slug}</loc><lastmod>${post.date}</lastmod></url>`,
      );
    }
  });

  it("only lists paginated blog pages beyond page 1, matching totalPages", async () => {
    const text = await GET().text();
    const pages = totalPages();
    if (pages > 1) {
      expect(text).toContain(`<loc>${SITE_URL}/blog/page/2</loc>`);
    } else {
      expect(text).not.toContain("/blog/page/");
    }
  });
});
