<script lang="ts">
  import { SITE_NAME, SITE_URL } from "$lib/blog/config";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  let post = $derived(data.post);
  let PostContent = $derived(data.component);

  let title = $derived(`${post.metadata.title} | ${SITE_NAME}`);
  let canonical = $derived(`${SITE_URL}/blog/${post.date}/${post.slug}`);
  let publishedIso = $derived(`${post.date}T00:00:00Z`);

  let jsonLd = $derived(
    JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: post.metadata.title,
      description: post.metadata.excerpt,
      author: { "@type": "Person", name: post.metadata.author },
      datePublished: publishedIso,
      mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
      url: canonical,
      // Escape "</" so a closing script tag can't appear inside the JSON payload.
    }).replace(/<\//g, "<\\/"),
  );

  // Built by concatenation, rather than one contiguous literal tag string, so
  // tooling scanning the raw source for a script closing tag doesn't mistake
  // this markup expression for the end of the block above.
  let ldJsonScriptTag = $derived(
    `<script type="application/ld+json">${jsonLd}<` + `/script>`,
  );

  function formatDate(date: string): string {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={post.metadata.excerpt} />
  <meta name="author" content={post.metadata.author} />
  <link rel="canonical" href={canonical} />
  <link rel="alternate" type="application/rss+xml" title={`${SITE_NAME} — Blog`} href={`${SITE_URL}/rss.xml`} />

  <meta property="og:type" content="article" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={post.metadata.title} />
  <meta property="og:description" content={post.metadata.excerpt} />
  <meta property="og:url" content={canonical} />
  <meta property="article:published_time" content={publishedIso} />
  <meta property="article:author" content={post.metadata.author} />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content={post.metadata.title} />
  <meta name="twitter:description" content={post.metadata.excerpt} />

  {@html ldJsonScriptTag}
</svelte:head>

<article class="mx-auto max-w-3xl">
  <a href="/blog" class="text-primary-600 dark:text-primary-500 text-sm">&larr; Back to Blog</a>
  <header class="mt-4 mb-8">
    <h1 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
      {post.metadata.title}
    </h1>
    <p class="mt-2 text-sm text-gray-500 dark:text-gray-400">
      By {post.metadata.author} &middot; <time datetime={post.date}>{formatDate(post.date)}</time>
    </p>
  </header>
  <div class="prose dark:prose-invert lg:prose-lg max-w-none">
    <PostContent />
  </div>
</article>
