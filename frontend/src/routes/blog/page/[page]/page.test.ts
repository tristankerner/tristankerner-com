import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import type { Post } from "$lib/blog/posts";
import BlogPagePage from "./+page.svelte";

const posts: Post[] = [
  { date: "2026-07-15", slug: "b", metadata: { title: "Post B", author: "A", excerpt: "E" } },
];

function renderPage(currentPage: number, totalPages: number) {
  return render(BlogPagePage, {
    props: {
      data: { posts, currentPage, totalPages },
      params: { page: String(currentPage) },
      form: undefined,
    },
  });
}

describe("blog paginated page", () => {
  it("renders the Blog heading and post list", () => {
    renderPage(2, 3);
    expect(screen.getByRole("heading", { name: "Blog", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Post B")).toBeInTheDocument();
  });

  it("renders a page-specific title and canonical link", () => {
    renderPage(2, 3);
    expect(document.title).toBe("Blog (page 2) | Tristan Kerner");
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      "https://tristankerner.com/blog/page/2",
    );
  });

  it("points rel=prev at /blog for page 2", () => {
    renderPage(2, 3);
    expect(document.querySelector('link[rel="prev"]')?.getAttribute("href")).toBe(
      "https://tristankerner.com/blog",
    );
  });

  it("points rel=prev at the previous numbered page beyond page 2", () => {
    renderPage(3, 3);
    expect(document.querySelector('link[rel="prev"]')?.getAttribute("href")).toBe(
      "https://tristankerner.com/blog/page/2",
    );
  });

  it("omits rel=prev on the first page", () => {
    renderPage(1, 3);
    expect(document.querySelector('link[rel="prev"]')).toBeFalsy();
  });

  it("omits rel=next on the last page", () => {
    renderPage(3, 3);
    expect(document.querySelector('link[rel="next"]')).toBeFalsy();
  });

  it("adds rel=next when not on the last page", () => {
    renderPage(2, 3);
    expect(document.querySelector('link[rel="next"]')?.getAttribute("href")).toBe(
      "https://tristankerner.com/blog/page/3",
    );
  });
});
