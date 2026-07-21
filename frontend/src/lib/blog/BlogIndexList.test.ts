import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import BlogIndexList from "./BlogIndexList.svelte";
import type { Post } from "./posts";

const posts: Post[] = [
  {
    date: "2026-07-15",
    slug: "b",
    metadata: { title: "Post B", author: "Author B", excerpt: "Excerpt B" },
  },
  {
    date: "2026-07-10",
    slug: "a",
    metadata: { title: "Post A", author: "Author A", excerpt: "Excerpt A" },
  },
];

describe("BlogIndexList", () => {
  it("shows an empty state when there are no posts", () => {
    render(BlogIndexList, { props: { posts: [], currentPage: 1, totalPages: 1 } });
    expect(screen.getByText(/no posts yet/i)).toBeInTheDocument();
  });

  it("renders a card per post with title, author, and excerpt", () => {
    render(BlogIndexList, { props: { posts, currentPage: 1, totalPages: 1 } });
    expect(screen.getByText("Post B")).toBeInTheDocument();
    expect(screen.getByText("Post A")).toBeInTheDocument();
    expect(screen.getByText(/Author B/)).toBeInTheDocument();
    expect(screen.getByText("Excerpt A")).toBeInTheDocument();
  });

  it("links each card to its permalink", () => {
    const { container } = render(BlogIndexList, {
      props: { posts, currentPage: 1, totalPages: 1 },
    });
    const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toContain("/blog/2026-07-15/b");
    expect(links).toContain("/blog/2026-07-10/a");
  });

  it("hides pagination entirely when there's only one page", () => {
    render(BlogIndexList, { props: { posts, currentPage: 1, totalPages: 1 } });
    expect(screen.queryByLabelText("Blog pagination")).not.toBeInTheDocument();
  });

  it("hides Previous but shows Next on the first page", () => {
    render(BlogIndexList, { props: { posts, currentPage: 1, totalPages: 3 } });
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("shows Previous but hides Next on the last page", () => {
    render(BlogIndexList, { props: { posts, currentPage: 3, totalPages: 3 } });
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("shows both Previous and Next on a middle page", () => {
    render(BlogIndexList, { props: { posts, currentPage: 2, totalPages: 3 } });
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("links page 1 to /blog rather than /blog/page/1", () => {
    const { container } = render(BlogIndexList, {
      props: { posts, currentPage: 2, totalPages: 3 },
    });
    const links = [...container.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(links).toContain("/blog");
    expect(links).toContain("/blog/page/3");
    expect(links).not.toContain("/blog/page/1");
  });
});
