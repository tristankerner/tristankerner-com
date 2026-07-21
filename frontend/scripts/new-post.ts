#!/usr/bin/env bun
// Scaffolds a new blog post file under src/lib/posts/.
//
// Usage:
//   bun run new-post -- --title "My Post Title" --author "Tristan Kerner" --date 2026-07-19 --template md
//
// The post's date and slug come entirely from the generated filename
// (src/lib/blog/posts.ts parses "YYYY-MM-DD-title-slug.{md,svelte}"), and
// posts are discovered at build time via `import.meta.glob`, so this script
// only needs to create that one file correctly - nothing else in the app
// needs to be touched (or regenerated) for the new post to be picked up by
// the next `bun run build`, including its prerendered /blog/[date]/[slug]
// route and its entry in the paginated index.

import { parseArgs } from "node:util";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const POSTS_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "lib", "posts");

export function printUsage(): void {
  console.log(
    `Usage: bun run new-post -- --title <title> --author <name> --date <YYYY-MM-DD> --template <svelte|md>`,
  );
}

export function slugify(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function isValidDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

export function mdTemplate(title: string, author: string): string {
  return `---
title: ${JSON.stringify(title)}
author: ${JSON.stringify(author)}
excerpt: "Write a one-to-two sentence summary of this post here."
---

Write your post content here using Markdown.
`;
}

export function svelteTemplate(title: string, author: string): string {
  return `<script module lang="ts">
  export const metadata = {
    title: ${JSON.stringify(title)},
    author: ${JSON.stringify(author)},
    excerpt: "Write a one-to-two sentence summary of this post here.",
  };
</script>

<p>Write your post content here using Svelte markup.</p>
`;
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const { values } = parseArgs({
    args: argv,
    options: {
      title: { type: "string" },
      author: { type: "string" },
      date: { type: "string" },
      template: { type: "string" },
      help: { type: "boolean" },
    },
    strict: true,
  });

  if (values.help) {
    printUsage();
    return;
  }

  const { title, author, date, template } = values;

  if (!title || !author || !date || !template) {
    printUsage();
    throw new Error(
      "Missing required argument(s): --title, --author, --date, --template are all required.",
    );
  }

  if (!isValidDate(date)) {
    throw new Error(`--date must be a real calendar date in YYYY-MM-DD format, got "${date}".`);
  }

  if (template !== "svelte" && template !== "md") {
    throw new Error(`--template must be "svelte" or "md", got "${template}".`);
  }

  const slug = slugify(title);
  if (!slug) {
    throw new Error(`--title "${title}" doesn't contain any usable characters for a URL slug.`);
  }

  const filename = `${date}-${slug}.${template}`;
  const filepath = join(POSTS_DIR, filename);

  if (existsSync(filepath)) {
    throw new Error(
      `${filepath} already exists - a post with this date and title slug is already scaffolded.`,
    );
  }

  await mkdir(POSTS_DIR, { recursive: true });
  const content = template === "md" ? mdTemplate(title, author) : svelteTemplate(title, author);
  await writeFile(filepath, content, "utf-8");

  console.log(`Created ${join("src", "lib", "posts", filename)}`);
  console.log(`Permalink once built: /blog/${date}/${slug}`);
  console.log("Add the post's content to that file, then run `bun run build` to prerender it.");
}

// Guarded so importing this module's helpers for tests doesn't also run the
// CLI against the test runner's own argv. import.meta.main is never true
// under the test runner, so this block is unreachable from tests by design.
/* v8 ignore start */
if (import.meta.main) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
/* v8 ignore stop */
