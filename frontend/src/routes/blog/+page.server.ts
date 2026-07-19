import { paginate, totalPages } from "$lib/blog/posts";
import type { PageServerLoad } from "./$types";

export const prerender = true;

export const load: PageServerLoad = () => {
  return {
    posts: paginate(1),
    currentPage: 1,
    totalPages: totalPages(),
  };
};
