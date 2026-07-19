<script lang="ts">
  import BlogIndexList from "$lib/blog/BlogIndexList.svelte";
  import { SITE_NAME, SITE_URL } from "$lib/blog/config";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();

  const description = "Posts on software, projects, and whatever else I've been building.";
  const title = $derived(`Blog (page ${data.currentPage}) | ${SITE_NAME}`);
  const canonical = $derived(`${SITE_URL}/blog/page/${data.currentPage}`);
  const prevHref = $derived(
    data.currentPage - 1 === 1 ? `${SITE_URL}/blog` : `${SITE_URL}/blog/page/${data.currentPage - 1}`,
  );
  const nextHref = $derived(`${SITE_URL}/blog/page/${data.currentPage + 1}`);
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  <link rel="alternate" type="application/rss+xml" title={`${SITE_NAME} — Blog`} href={`${SITE_URL}/rss.xml`} />
  {#if data.currentPage > 1}
    <link rel="prev" href={prevHref} />
  {/if}
  {#if data.currentPage < data.totalPages}
    <link rel="next" href={nextHref} />
  {/if}

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content={SITE_NAME} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />

  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
</svelte:head>

<h1 class="mb-8 text-center text-3xl font-bold dark:text-white">Blog</h1>
<BlogIndexList posts={data.posts} currentPage={data.currentPage} totalPages={data.totalPages} />
