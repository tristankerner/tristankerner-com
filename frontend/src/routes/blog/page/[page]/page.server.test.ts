import { beforeEach, describe, expect, it, vi } from "vitest";
import { isHttpError, isRedirect } from "@sveltejs/kit";

// Mocked rather than driven off the real posts/ fixtures: the real content
// currently fits on a single page, so a "load page 2 successfully" case is
// unreachable against real data. Mocking the data layer lets every pagination
// boundary (redirect, 404 below/above range, success) be exercised
// deterministically regardless of how much real blog content exists.
const totalPages = vi.fn(() => 3);
const paginate = vi.fn((page: number) => [`fixture-page-${page}`]);

vi.mock("$lib/blog/posts", () => ({
  totalPages: (...args: []) => totalPages(...args),
  paginate: (page: number) => paginate(page),
}));

import { entries, load, prerender } from "./+page.server.ts";

describe("blog paginated route", () => {
  beforeEach(() => {
    totalPages.mockReturnValue(3);
  });

  it("prerenders", () => {
    expect(prerender).toBe(true);
  });

  it("generates entries for pages 2..N only", () => {
    expect(entries()).toEqual([{ page: "2" }, { page: "3" }]);
  });

  it("generates no entries when there is only one page", () => {
    totalPages.mockReturnValue(1);
    expect(entries()).toEqual([]);
  });

  it("404s for a non-integer page", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => load({ params: { page: "abc" } } as any)).toThrow();
    try {
      load({ params: { page: "abc" } } as any);
    } catch (e) {
      expect(isHttpError(e, 404)).toBe(true);
    }
  });

  it("404s for page zero", () => {
    try {
      load({ params: { page: "0" } } as any);
      throw new Error("expected a 404");
    } catch (e) {
      expect(isHttpError(e, 404)).toBe(true);
    }
  });

  it("redirects page 1 to /blog", () => {
    try {
      load({ params: { page: "1" } } as any);
      throw new Error("expected a redirect");
    } catch (e) {
      expect(isRedirect(e)).toBe(true);
      expect((e as { status: number }).status).toBe(308);
      expect((e as { location: string }).location).toBe("/blog");
    }
  });

  it("404s past the last page", () => {
    try {
      load({ params: { page: "4" } } as any);
      throw new Error("expected a 404");
    } catch (e) {
      expect(isHttpError(e, 404)).toBe(true);
    }
  });

  it("returns the requested page of posts when in range", () => {
    const result = load({ params: { page: "2" } } as any);
    expect(result).toEqual({
      posts: paginate(2),
      currentPage: 2,
      totalPages: 3,
    });
  });
});
