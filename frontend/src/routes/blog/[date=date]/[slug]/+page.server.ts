import { error } from "@sveltejs/kit";
import { componentPathFor, findPost, posts } from "$lib/blog/posts";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

export const entries: EntryGenerator = () =>
  posts.map((post) => ({ date: post.date, slug: post.slug }));

export const load: PageServerLoad = ({ params }) => {
  const post = findPost(params.date, params.slug);
  if (!post) {
    error(404, "Post not found");
  }
  return { post, componentPath: componentPathFor(post) };
};
