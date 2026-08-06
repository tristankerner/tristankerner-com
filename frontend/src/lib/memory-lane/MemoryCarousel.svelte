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

    // The flowbite Carousel wrapper is a CSS grid with a fixed height sized for its own
    // built-in slide markup. Our custom slides need to grow with their text instead of
    // being clipped, so we override the fixed height with a floor (min-height) and let
    // the grid's auto row-sizing stretch the wrapper to fit whichever slide is longest.
    const carouselClass = $derived(
        `h-auto min-h-56 sm:h-auto sm:min-h-64 xl:h-auto xl:min-h-80 2xl:h-auto 2xl:min-h-96 ${className}`
    );
</script>

<Carousel {images} aria-label={ariaLabel} class={carouselClass} slideDuration={0}>
    {#snippet slide({ index })}
        {@const current = slides[index]}
        {#key index}
            <div
                class="flex w-full flex-col items-center justify-center gap-4 bg-gray-700 text-center sm:flex-row sm:text-left {slides.length > 1
                    ? 'px-16 pt-6 pb-10 sm:px-20'
                    : 'p-6'}"
                in:fade={{ duration: 300 }}
            >
                {#if current.image}
                    <img
                        src={current.image.src}
                        alt={current.image.alt}
                        class="h-32 w-full shrink-0 rounded-lg object-cover sm:h-64 sm:w-1/3 xl:h-80 2xl:h-96"
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
