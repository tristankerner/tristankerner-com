import { loadPostComponent } from "$lib/blog/post-components";
import type { PageLoad } from "./$types";

// The server load supplies the metadata; here we only attach the post's
// lazily imported content component (its own chunk, fetched per post).
export const load: PageLoad = async ({ data }) => {
  return { ...data, component: await loadPostComponent(data.componentPath) };
};
