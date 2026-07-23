<script lang="ts">
    import { page } from "$app/state";
    import { fly } from "svelte/transition";
    import {themeState, counterState} from "./state.svelte.ts";
    import type {SingleDigit} from "./assets/DigitalDigitSvg/types.ts";
    import DigitalDigitSvg from "$lib/assets/DigitalDigitSvg/DigitalDigitSvg.svelte";
    import { Tooltip } from "flowbite-svelte";
    interface Props {
        class?: string;
    }
    let { class: className }: Props = $props();

    const homeCount = $derived(
        counterState.pageCounts.find((p) => p.path === '/')?.total_unique_visitors ?? 0
    );
    const count = $derived(
        counterState.pageCounts.find((p) => p.path === page.url.pathname)?.total_unique_visitors
            ?? homeCount
    );
    let countStr = $derived([...count.toString().padStart(5, '0')]) as SingleDigit[];
</script>
<div class="{className}">
    <div class="flex" aria-label="counter">
    {#each countStr as digit, i (i)}
        <div class="relative h-6 w-4 overflow-hidden md:h-10 md:w-7">
            {#key digit}
                <div
                        class="absolute inset-0"
                        in:fly={{ y: '100%', duration: 350 }}
                        out:fly={{ y: '-100%', duration: 350 }}
                >
                    <DigitalDigitSvg
                            digit={digit}
                            class="h-full w-full"
                            strokeWidth={48}
                            bgColor={themeState.darkMode === true ? '#000000' : '#FFFFFF'}
                            textColor={themeState.darkMode === true ? '#FFFFFF' : '#000000'}
                    >
                    </DigitalDigitSvg>
                </div>
            {/key}
        </div>
    {/each}
    </div>
    <Tooltip>A throwback to old-timey website visitor counters.</Tooltip>
</div>
