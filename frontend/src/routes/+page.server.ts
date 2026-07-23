import { paginate, posts } from "$lib/blog/posts";
import type { PageServerLoad } from "./$types";

export const prerender = true;

const RECENT_POSTS = 3;

export const load: PageServerLoad = () => {
  return {
    recentPosts: paginate(1).slice(0, RECENT_POSTS),
    hasMorePosts: posts.length > RECENT_POSTS,
  };
};
