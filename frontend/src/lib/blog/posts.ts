import { POSTS_PER_PAGE } from "./config";

export interface PostMetadata {
  title: string;
  author: string;
  excerpt: string;
}

export interface Post {
  date: string;
  slug: string;
  metadata: PostMetadata;
}

// `YYYY-MM-DD-title-slug.{md,svx,svelte}` is the single source of truth for a
// post's date and slug (and therefore its /blog/[date]/[slug] permalink) -
// the scaffolding script (scripts/new-post.ts) names files this way, so
// nothing else needs to be registered when a post is added or removed.
const FILENAME_PATTERN = /^(\d{4}-\d{2}-\d{2})-(.+)\.(?:md|svx|svelte)$/;

// Eagerly importing every post keeps this module server/build-time only: it
// must never be imported from client-reachable code (components or universal
// loads), or the whole registry - post content included - ends up in the
// client bundle. Pages get metadata via server loads and post content via the
// lazy per-post glob in post-components.ts.
const metadataModules = import.meta.glob<PostMetadata | undefined>(
  "/src/lib/posts/*.{md,svx,svelte}",
  { eager: true, import: "metadata" },
);

const componentPathByPermalink = new Map<string, string>();

export const posts: Post[] = Object.entries(metadataModules)
  .map(([path, metadata]) => {
    const filename = path.split("/").pop() ?? path;
    const match = filename.match(FILENAME_PATTERN);
    if (!match) {
      throw new Error(
        `Blog post file "${filename}" doesn't match the required "YYYY-MM-DD-title-slug.md|svx|svelte" naming pattern.`,
      );
    }
    if (!metadata) {
      throw new Error(
        `Blog post file "${filename}" is missing its "metadata" export (title, author, excerpt).`,
      );
    }
    const [, date, slug] = match;
    componentPathByPermalink.set(`${date}/${slug}`, path);
    return { date, slug, metadata };
  })
  .sort((a, b) => (a.date === b.date ? a.slug.localeCompare(b.slug) : b.date < a.date ? -1 : 1));

export function totalPages(): number {
  return Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
}

export function paginate(page: number): Post[] {
  const start = (page - 1) * POSTS_PER_PAGE;
  return posts.slice(start, start + POSTS_PER_PAGE);
}

export function findPost(date: string, slug: string): Post | undefined {
  return posts.find((post) => post.date === date && post.slug === slug);
}

export function componentPathFor(post: Post): string {
  const path = componentPathByPermalink.get(`${post.date}/${post.slug}`);
  if (!path) {
    throw new Error(`No component module for post ${post.date}/${post.slug}.`);
  }
  return path;
}
