<script lang="ts">
    import { Badge, Timeline, TimelineItem } from "flowbite-svelte";
    import MemoryCarousel from "$lib/memory-lane/MemoryCarousel.svelte";
    import { memories } from "./content";

    function formatYear(date: string): string {
        return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-US", {
            year: "numeric",
            timeZone: "UTC",
        });
    }
</script>

<div class="mx-auto max-w-3xl">
    <h1 class="mb-2 text-center text-3xl font-bold dark:text-white">Memory Ln</h1>
    <p class="mb-8 text-center text-gray-600 dark:text-gray-400">A running scrapbook of milestones, roughly in order.</p>

    <nav aria-label="Jump to a memory" class="mb-10 flex flex-wrap justify-center gap-2">
        {#each memories as memory (memory.id)}
            <Badge href={`#${memory.id}`} color="primary" rounded>{formatYear(memory.date)} &middot; {memory.title}</Badge>
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
