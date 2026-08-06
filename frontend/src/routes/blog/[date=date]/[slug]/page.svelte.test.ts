import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/svelte";
import { componentPathFor, posts } from "$lib/blog/posts";
import { loadPostComponent } from "$lib/blog/post-components";
import PostPage from "./+page.svelte";

async function renderPost(slug: string) {
  const post = posts.find((p) => p.slug === slug)!;
  const component = await loadPostComponent(componentPathFor(post));
  const data = { post, componentPath: componentPathFor(post), component };
  return { post, ...render(PostPage, { props: { data } }) };
}

describe("blog post page", () => {
  it("renders the post title and a back-to-blog link", async () => {
    const { post } = await renderPost("hello-blog");
    expect(
      screen.getByRole("heading", { name: post.metadata.title, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to blog/i })).toHaveAttribute("href", "/blog");
  });

  it("renders the post's author and content", async () => {
    const { post, container } = await renderPost("hello-blog");
    expect(container.textContent).toContain(post.metadata.author);
    expect(container.querySelector(".prose")?.textContent?.trim().length).toBeGreaterThan(0);
  });

  it("sets the document title, canonical link, and description", async () => {
    const { post } = await renderPost("hello-blog");
    expect(document.title).toBe(`${post.metadata.title} | Tristan Kerner`);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute("href")).toBe(
      `https://tristankerner.com/blog/${post.date}/${post.slug}`,
    );
    expect(document.querySelector('meta[name="description"]')?.getAttribute("content")).toBe(
      post.metadata.excerpt,
    );
  });

  it("embeds a valid, script-safe JSON-LD BlogPosting tag", async () => {
    const { post } = await renderPost("hello-blog");
    const script = document.querySelector('script[type="application/ld+json"]');
    expect(script).toBeTruthy();

    const json = JSON.parse(script!.textContent ?? "");
    expect(json["@type"]).toBe("BlogPosting");
    expect(json.headline).toBe(post.metadata.title);
    expect(json.author).toEqual({ "@type": "Person", name: post.metadata.author });
    expect(json.url).toBe(`https://tristankerner.com/blog/${post.date}/${post.slug}`);
  });

  it("renders the .svelte-templated post too", async () => {
    const { post, container } = await renderPost("live-visitor-counter");
    expect(
      screen.getByRole("heading", { name: post.metadata.title, level: 1 }),
    ).toBeInTheDocument();
    expect(container.querySelector(".prose")?.textContent?.trim().length).toBeGreaterThan(0);
  });
});
