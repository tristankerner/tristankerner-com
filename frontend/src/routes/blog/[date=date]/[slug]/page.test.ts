import { describe, expect, it } from "vitest";
import { componentPathFor, posts } from "$lib/blog/posts";
import { load } from "./+page.ts";

describe("blog post universal load", () => {
  it("attaches the lazily loaded content component to the server data", async () => {
    const post = posts[0];
    const data = { post, componentPath: componentPathFor(post) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await load({ data } as any);
    expect(result.post).toBe(post);
    expect(result.component).toBeTruthy();
  });
});
