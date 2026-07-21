import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import type { Post } from "$lib/blog/posts";
import BlogPage from "./+page.svelte";

const posts: Post[] = [
  { date: "2026-07-15", slug: "b", metadata: { title: "Post B", author: "A", excerpt: "E" } },
];

describe("blog index page", () => {
  it("renders the Blog heading and post list", () => {
    render(BlogPage, { props: { data: { posts, currentPage: 1, totalPages: 1 } } });
    expect(screen.getByRole("heading", { name: "Blog", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Post B")).toBeInTheDocument();
  });

  it("sets the document title", () => {
    render(BlogPage, { props: { data: { posts, currentPage: 1, totalPages: 1 } } });
    expect(document.title).toBe("Blog | Tristan Kerner");
  });

  it("adds a rel=next link when there is more than one page", () => {
    render(BlogPage, { props: { data: { posts, currentPage: 1, totalPages: 2 } } });
    expect(document.querySelector('link[rel="next"]')?.getAttribute("href")).toBe(
      "https://tristankerner.com/blog/page/2",
    );
  });

  it("omits rel=next when there's only one page", () => {
    render(BlogPage, { props: { data: { posts, currentPage: 1, totalPages: 1 } } });
    expect(document.querySelector('link[rel="next"]')).toBeFalsy();
  });
});
