import { describe, expect, it } from "vitest";
import { POSTS_PER_PAGE } from "./config";
import {
  comparePosts,
  componentPathFor,
  findPost,
  paginate,
  parsePostEntry,
  posts,
  totalPages,
  type Post,
} from "./posts";

// `posts` is built at module load time from the real files under
// src/lib/posts/ via `import.meta.glob`, so these assertions reference two
// specific real posts (2026-07-10-hello-blog.md and
// 2026-07-15-live-visitor-counter.svelte) that are expected to keep
// existing - but deliberately avoid asserting the *total* post count or
// exact ordering array, so adding a new post never breaks this suite (blog
// post content itself is excluded from the coverage requirement in
// vite.config.ts; new posts shouldn't need a matching test either). For the
// same reason, assertions against these real posts check shape (non-empty
// string, etc.) rather than literal title/author/excerpt text, so editing
// post content never breaks this suite either.
describe("posts registry", () => {
  it("discovers at least the known posts under src/lib/posts", () => {
    expect(posts.length).toBeGreaterThanOrEqual(2);
  });

  it("sorts posts newest-first, ties broken by slug", () => {
    for (let i = 0; i + 1 < posts.length; i++) {
      expect(comparePosts(posts[i], posts[i + 1])).toBeLessThanOrEqual(0);
    }
  });

  it("parses date and slug from the filename", () => {
    const post = posts.find((p) => p.slug === "hello-blog");
    expect(post?.date).toBe("2026-07-10");
  });

  it("exposes each post's metadata", () => {
    const post = posts.find((p) => p.slug === "hello-blog");
    expect(post?.metadata.title.length).toBeGreaterThan(0);
    expect(post?.metadata.author.length).toBeGreaterThan(0);
    expect(post?.metadata.excerpt.length).toBeGreaterThan(0);
  });

  it("reads metadata from a .svelte post's module-level export too", () => {
    const post = posts.find((p) => p.slug === "live-visitor-counter");
    expect(post?.metadata.title.length).toBeGreaterThan(0);
  });
});

describe("totalPages", () => {
  it("is always at least 1, and matches the real post count", () => {
    expect(totalPages()).toBeGreaterThanOrEqual(1);
    expect(totalPages()).toBe(Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE)));
  });
});

describe("paginate", () => {
  it("never returns more than a page's worth of posts", () => {
    for (let page = 1; page <= totalPages(); page++) {
      expect(paginate(page).length).toBeLessThanOrEqual(POSTS_PER_PAGE);
    }
  });

  it("concatenating every page reconstructs the full, ordered posts list", () => {
    const reconstructed = Array.from({ length: totalPages() }, (_, i) => paginate(i + 1)).flat();
    expect(reconstructed).toEqual(posts);
  });

  it("returns nothing past the last page", () => {
    expect(paginate(totalPages() + 1)).toEqual([]);
  });
});

describe("findPost", () => {
  it("finds a post by date and slug", () => {
    const post = findPost("2026-07-10", "hello-blog");
    expect(post?.metadata.title.length).toBeGreaterThan(0);
  });

  it("returns undefined for an unknown permalink", () => {
    expect(findPost("1999-01-01", "does-not-exist")).toBeUndefined();
  });

  it("returns undefined when the slug doesn't match the date", () => {
    expect(findPost("2026-07-10", "live-visitor-counter")).toBeUndefined();
  });
});

describe("componentPathFor", () => {
  it("resolves a glob-importable path for a real post", () => {
    const post = posts.find((p) => p.slug === "hello-blog")!;
    expect(componentPathFor(post)).toBe("/src/lib/posts/2026-07-10-hello-blog.md");
  });

  it("throws for a post that isn't in the registry", () => {
    const fakePost: Post = {
      date: "1999-01-01",
      slug: "not-real",
      metadata: { title: "x", author: "x", excerpt: "x" },
    };
    expect(() => componentPathFor(fakePost)).toThrow(/No component module/);
  });
});

describe("parsePostEntry", () => {
  const metadata = { title: "t", author: "a", excerpt: "e" };

  it("parses a well-formed filename", () => {
    expect(parsePostEntry("/src/lib/posts/2026-01-01-my-post.md", metadata)).toEqual({
      date: "2026-01-01",
      slug: "my-post",
      metadata,
    });
  });

  it("throws for a filename that doesn't match the naming pattern", () => {
    expect(() => parsePostEntry("/src/lib/posts/not-a-valid-name.md", metadata)).toThrow(
      /naming pattern/,
    );
  });

  it("throws when the module has no metadata export", () => {
    expect(() => parsePostEntry("/src/lib/posts/2026-01-01-my-post.md", undefined)).toThrow(
      /missing its "metadata" export/,
    );
  });
});

describe("comparePosts", () => {
  const post = (date: string, slug: string): Post => ({
    date,
    slug,
    metadata: { title: "t", author: "a", excerpt: "e" },
  });

  it("sorts newer dates before older dates", () => {
    expect(comparePosts(post("2026-01-02", "a"), post("2026-01-01", "b"))).toBeLessThan(0);
    expect(comparePosts(post("2026-01-01", "a"), post("2026-01-02", "b"))).toBeGreaterThan(0);
  });

  it("breaks same-date ties alphabetically by slug", () => {
    expect(comparePosts(post("2026-01-01", "a"), post("2026-01-01", "b"))).toBeLessThan(0);
    expect(comparePosts(post("2026-01-01", "b"), post("2026-01-01", "a"))).toBeGreaterThan(0);
  });
});
