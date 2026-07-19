import { error, redirect } from "@sveltejs/kit";
import { paginate, totalPages } from "$lib/blog/posts";
import type { EntryGenerator, PageServerLoad } from "./$types";

export const prerender = true;

// Page 1 lives at /blog itself, so only pages 2..N need their own prerendered route.
export const entries: EntryGenerator = () => {
  const pages = totalPages();
  return Array.from({ length: Math.max(0, pages - 1) }, (_, i) => ({ page: String(i + 2) }));
};

export const load: PageServerLoad = ({ params }) => {
  const page = Number(params.page);
  if (!Number.isInteger(page) || page < 1) {
    error(404, "Not found");
  }
  if (page === 1) {
    redirect(308, "/blog");
  }

  const pages = totalPages();
  if (page > pages) {
    error(404, "Not found");
  }

  return {
    posts: paginate(page),
    currentPage: page,
    totalPages: pages,
  };
};
