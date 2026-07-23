<script lang="ts">
    import { Button, Card } from "flowbite-svelte";
    import profilePhoto from "$lib/assets/profile-photo.jpg";
    import { profile } from "./about-me/content";
    import { SITE_NAME, SITE_URL } from "$lib/blog/config";
    import type { PageProps } from "./$types";

    let { data }: PageProps = $props();

    const title = SITE_NAME;
    const description = "Software engineer writing about platform engineering, integrations, and side projects.";

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
    <meta name="description" content={description} />
    <link rel="canonical" href={SITE_URL} />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content={SITE_NAME} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={SITE_URL} />

    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
</svelte:head>

<div class="mx-auto max-w-5xl">
    <section
        class="mb-10 flex flex-col items-center gap-6 rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:flex-row sm:text-left dark:border-gray-700 dark:bg-gray-800"
    >
        <img
            src={profilePhoto}
            alt={profile.name}
            class="ring-primary-100 dark:ring-primary-900 h-32 w-32 shrink-0 rounded-full object-cover ring-4 sm:h-40 sm:w-40"
        />
        <div>
            <h1 class="text-3xl font-bold text-gray-900 dark:text-white">{profile.name}</h1>
            <p class="text-primary-600 dark:text-primary-500 mt-1 text-lg font-medium">
                <span>{profile.title}</span> <span class="text-gray-400 dark:text-gray-500">|</span>
                <span>{profile.tagline}</span>
            </p>
            <p class="mt-4 text-gray-600 dark:text-gray-400">
                Welcome — this is where I write about the software I build and the problems I run into along the way.
            </p>
            <div class="mt-6 flex flex-wrap justify-center gap-3 sm:justify-start">
                <Button href="/blog" color="primary">Read the Blog</Button>
                <Button href="/about-me" color="alternative">About Me</Button>
            </div>
        </div>
    </section>

    <section>
        <div class="mb-4 flex items-center justify-between">
            <h2 class="text-xl font-bold text-gray-900 dark:text-white">Latest Posts</h2>
            {#if data.hasMorePosts}
                <a href="/blog" class="text-primary-600 dark:text-primary-500 text-sm font-medium hover:underline">
                    View all posts &rarr;
                </a>
            {/if}
        </div>
        <div class="grid gap-6 md:grid-cols-3">
            {#each data.recentPosts as post (post.date + "/" + post.slug)}
                <Card size="xl" href={`/blog/${post.date}/${post.slug}`} class="hover:shadow-lg">
                    <h3 class="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
                        {post.metadata.title}
                    </h3>
                    <p class="mb-2 text-xs text-gray-500 dark:text-gray-400">
                        <time datetime={post.date}>{formatDate(post.date)}</time>
                    </p>
                    <p class="text-sm font-normal text-gray-700 dark:text-gray-400">{post.metadata.excerpt}</p>
                </Card>
            {:else}
                <p class="text-gray-500 dark:text-gray-400">No posts yet &mdash; check back soon.</p>
            {/each}
        </div>
    </section>
</div>
