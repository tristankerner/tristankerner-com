<script lang="ts">
    import { Carousel, Controls, CarouselIndicators } from "flowbite-svelte";
    import { fade } from "svelte/transition";
    import type { MemorySlide } from "./types";

    interface Props {
        slides: MemorySlide[];
        ariaLabel: string;
        class?: string;
    }
    let { slides, ariaLabel, class: className = "" }: Props = $props();

    // The Carousel component drives its slide count and indicators off `images`,
    // even though the actual slide markup is fully custom below.
    const images = $derived(slides.map((slide) => (slide.image ? { src: slide.image.src, alt: slide.image.alt } : {})));
</script>

<Carousel {images} aria-label={ariaLabel} class={className} slideDuration={0}>
    {#snippet slide({ index })}
        {@const current = slides[index]}
        {#key index}
            <div
                class="absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-4 bg-gray-700 p-6 text-center sm:flex-row sm:text-left"
                in:fade={{ duration: 300 }}
            >
                {#if current.image}
                    <img
                        src={current.image.src}
                        alt={current.image.alt}
                        class="h-32 w-full shrink-0 rounded-lg object-cover sm:h-full sm:w-1/3"
                    />
                {/if}
                <p class="text-gray-100">{current.text}</p>
            </div>
        {/key}
    {/snippet}
    {#snippet children()}
        {#if slides.length > 1}
            <Controls />
            <CarouselIndicators />
        {/if}
    {/snippet}
</Carousel>
