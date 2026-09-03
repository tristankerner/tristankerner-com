import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import HomePage from "./+page.svelte";
import { profile } from "./about-me/content";

const data = {
  recentPosts: [
    {
      date: "2026-07-15",
      slug: "live-visitor-counter",
      metadata: {
        title: "Live Visitor Counter",
        author: "Tristan Kerner",
        excerpt: "How the counter works.",
      },
    },
    {
      date: "2026-07-10",
      slug: "hello-blog",
      metadata: { title: "Hello, Blog", author: "Tristan Kerner", excerpt: "Kicking things off." },
    },
  ],
  hasMorePosts: false,
};

describe("home page", () => {
  it("renders the profile name, title, and photo", () => {
    render(HomePage, { props: { data, params: {}, form: undefined } });
    expect(screen.getByRole("heading", { level: 1, name: profile.name })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: profile.name })).toBeInTheDocument();
    expect(screen.getByText(profile.title!, { exact: false })).toBeInTheDocument();
    expect(screen.getByText(profile.tagline!, { exact: false })).toBeInTheDocument();
  });

  it("links to the blog and about-me pages", () => {
    render(HomePage, { props: { data, params: {}, form: undefined } });
    expect(screen.getByRole("link", { name: "Read the Blog" })).toHaveAttribute("href", "/blog");
    expect(screen.getByRole("link", { name: "About Me" })).toHaveAttribute("href", "/about-me");
  });

  it("renders a card for each recent post", () => {
    render(HomePage, { props: { data, params: {}, form: undefined } });
    for (const post of data.recentPosts) {
      const link = screen.getByRole("link", { name: new RegExp(post.metadata.title) });
      expect(link).toHaveAttribute("href", `/blog/${post.date}/${post.slug}`);
      expect(screen.getByText(post.metadata.excerpt)).toBeInTheDocument();
    }
  });

  it('shows a "View all posts" link only when there are more posts than shown', () => {
    const { rerender } = render(HomePage, { props: { data, params: {}, form: undefined } });
    expect(screen.queryByRole("link", { name: /View all posts/ })).not.toBeInTheDocument();

    rerender({ data: { ...data, hasMorePosts: true } });
    expect(screen.getByRole("link", { name: /View all posts/ })).toHaveAttribute("href", "/blog");
  });

  it("renders a fallback message when there are no posts yet", () => {
    render(HomePage, {
      props: { data: { recentPosts: [], hasMorePosts: false }, params: {}, form: undefined },
    });
    expect(screen.getByText(/No posts yet/)).toBeInTheDocument();
  });
});
