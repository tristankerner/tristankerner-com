<script lang="ts">
    import {themeState} from "./state.svelte.ts";
    import type {SingleDigit} from "./assets/DigitalDigitSvg/types.ts";
    interface Props {
        class?: string;
        count: number;
    }
    let { class: className, count }: Props = $props();
    let countStr = $derived([... count.toString()]) as SingleDigit[];
    import DigitalDigitSvg from "$lib/assets/DigitalDigitSvg/DigitalDigitSvg.svelte";
</script>
<div class="{className}">
    <div class="flex gap-1/2" aria-label="counter">
    {#each [...countStr] as char}
        <DigitalDigitSvg
                digit={char}
                class="h-6 w-6 md:h-10 md:w-10"
                strokeWidth={48}
                bgColor={themeState.darkMode === true ? '#000000' : '#FFFFFF'}
                textColor={themeState.darkMode === true ? '#FFFFFF' : '#000000'}
        >
        </DigitalDigitSvg>
    {/each}
    </div>
</div>