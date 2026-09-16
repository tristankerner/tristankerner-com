<script lang="ts">
    import { Badge, Timeline, TimelineItem } from "flowbite-svelte";
    import MemoryCarousel from "$lib/memory-lane/MemoryCarousel.svelte";
    import { memories } from "./content";
    import { SITE_NAME, SITE_URL } from "$lib/blog/config";

    const title = `Memory Ln | ${SITE_NAME}`;
    const description = "A running scrapbook of milestones, roughly in order.";
    const canonical = `${SITE_URL}/memory-lane`;

    function formatYear(date: string): string {
        return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
            year: "numeric",
            timeZone: "UTC",
        });
    }
</script>

<svelte:head>
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={canonical} />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content={SITE_NAME} />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={canonical} />

    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
</svelte:head>

<div class="mx-auto max-w-3xl">
    <h1 class="mb-2 text-center text-3xl font-bold dark:text-white">Memory Ln</h1>
    <p class="mb-8 text-center text-gray-600 dark:text-gray-400">A running scrapbook of milestones, roughly in order.</p>

    <nav aria-label="Jump to a memory" class="mb-10 flex flex-wrap justify-center gap-2">
        {#each memories as memory (memory.id)}
            <Badge href={`#${memory.id}`} color="primary" rounded>
                <span>{formatYear(memory.date)}</span> &middot; <span>{memory.title}</span>
            </Badge>
        {/each}
    </nav>

    <Timeline>
        {#each memories as memory, i (memory.id)}
            <TimelineItem
                id={memory.id}
                date={memory.date}
                dateFormat="year"
                title={memory.title}
                isLast={i === memories.length - 1}
                class="scroll-mt-24"
            >
                <MemoryCarousel slides={memory.slides} ariaLabel={`${memory.title} photos`} class="mt-3 mb-6" />
            </TimelineItem>
        {/each}
    </Timeline>
</div>
