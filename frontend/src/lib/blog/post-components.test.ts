import { describe, expect, it } from "vitest";
import { loadPostComponent } from "./post-components";
import { componentPathFor, posts } from "./posts";

describe("loadPostComponent", () => {
  it("lazily loads the Svelte component for a real post", async () => {
    const post = posts.find((p) => p.slug === "hello-blog")!;
    const component = await loadPostComponent(componentPathFor(post));
    expect(component).toBeTruthy();
  });

  it("loads the .svelte post template too", async () => {
    const post = posts.find((p) => p.slug === "live-visitor-counter")!;
    const component = await loadPostComponent(componentPathFor(post));
    expect(component).toBeTruthy();
  });

  it("throws for a path with no matching module", async () => {
    await expect(loadPostComponent("/src/lib/posts/nope.md")).rejects.toThrow(
      /No post component module/,
    );
  });
});
