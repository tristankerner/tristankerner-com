<script lang="ts">
  import { Card, PaginationItem } from "flowbite-svelte";
  import type { Post } from "./posts";

  let {
    posts,
    currentPage,
    totalPages,
  }: { posts: Post[]; currentPage: number; totalPages: number } = $props();

  function pageHref(page: number): string {
    return page === 1 ? "/blog" : `/blog/page/${page}`;
  }

  function formatDate(date: string): string {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  }
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-6">
  {#each posts as post (post.date + "/" + post.slug)}
    <Card size="xl" href={`/blog/${post.date}/${post.slug}`} class="hover:shadow-lg">
      <h2 class="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
        {post.metadata.title}
      </h2>
      <p class="mb-3 text-sm text-gray-500 dark:text-gray-400">
        By {post.metadata.author} &middot; <time datetime={post.date}>{formatDate(post.date)}</time>
      </p>
      <p class="font-normal text-gray-700 dark:text-gray-400">{post.metadata.excerpt}</p>
      <span class="text-primary-600 dark:text-primary-500 mt-3 inline-flex items-center font-medium">
        Read more &rarr;
      </span>
    </Card>
  {:else}
    <p class="text-gray-500 dark:text-gray-400">No posts yet &mdash; check back soon.</p>
  {/each}

  {#if totalPages > 1}
    <nav aria-label="Blog pagination" class="mt-4 flex justify-center">
      <ul class="inline-flex -space-x-px rtl:space-x-reverse">
        {#if currentPage > 1}
          <li>
            <PaginationItem href={pageHref(currentPage - 1)} class="rounded-s-lg">Previous</PaginationItem>
          </li>
        {/if}
        {#each Array(totalPages) as _, i (i)}
          <li>
            <PaginationItem href={pageHref(i + 1)} active={i + 1 === currentPage}>
              {i + 1}
            </PaginationItem>
          </li>
        {/each}
        {#if currentPage < totalPages}
          <li>
            <PaginationItem href={pageHref(currentPage + 1)} class="rounded-e-lg">Next</PaginationItem>
          </li>
        {/if}
      </ul>
    </nav>
  {/if}
</div>
