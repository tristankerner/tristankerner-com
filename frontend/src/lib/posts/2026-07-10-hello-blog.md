---
title: "Hello, Blog"
author: "Tristan Kerner"
excerpt: "A quick note on why this site now has a blog, and how it's built."
---

This site just grew a blog. Posts live as plain `.md` or `.svelte` files under
`src/lib/posts/`, get discovered automatically at build time, and are prerendered
to static HTML alongside the rest of the site - no server, no database, no
runtime content fetch.

## Why static

The whole site already deploys as a fully static SvelteKit build served by a
small actix-web server on a resource-constrained VPS. Keeping the blog static
means new posts cost nothing at request time - they're just more files in the
build output.

```bash
bun run new-post -- --title "My Next Post" --author "Tristan Kerner" \
  --date 2026-08-01 --template md
```

That scaffolds a new post file; the content still gets written by hand afterward.
