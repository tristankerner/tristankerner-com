import { describe, expect, it, vi } from "vitest";

// Separate from server.test.ts because it needs $lib/blog/posts mocked: the
// real posts/ fixtures currently fit on a single page, so the "more than one
// blog page" branch of GET() is otherwise unreachable.
vi.mock("$lib/blog/posts", () => ({
  posts: [],
  totalPages: () => 3,
}));

import { GET } from "./+server.ts";
import { SITE_URL } from "$lib/blog/config";

describe("GET /sitemap.xml with more than one blog page", () => {
  it("lists every paginated blog page beyond page 1", async () => {
    const text = await GET().text();
    expect(text).toContain(`<url><loc>${SITE_URL}/blog/page/2</loc></url>`);
    expect(text).toContain(`<url><loc>${SITE_URL}/blog/page/3</loc></url>`);
    expect(text).not.toContain("/blog/page/1<");
    expect(text).not.toContain("/blog/page/4<");
  });
});
