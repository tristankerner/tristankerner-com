<script lang="ts">
  import { onMount } from "svelte";
  import { Button, Modal, Toggle } from "flowbite-svelte";
  import { consentState } from "./state.svelte.ts";
  import { acceptAll, declineAll, initConsent, savePreferences } from "./consent.ts";

  let modalOpen = $state(false);
  let draftAnalytics = $state(true);
  let draftMarketing = $state(true);

  onMount(() => {
    initConsent();
  });

  export function openPreferences() {
    draftAnalytics = consentState.categories.analytics;
    draftMarketing = consentState.categories.marketing;
    modalOpen = true;
  }

  function handleAcceptAll() {
    draftAnalytics = true;
    draftMarketing = true;
    acceptAll();
    modalOpen = false;
  }

  function handleSavePreferences() {
    savePreferences({ analytics: draftAnalytics, marketing: draftMarketing });
    modalOpen = false;
  }
</script>

{#if consentState.status === "pending"}
  <div
    class="fixed inset-x-0 bottom-0 z-50 border-t border-gray-200 bg-white p-4 shadow-lg sm:p-6 dark:border-gray-700 dark:bg-gray-800"
    role="region"
    aria-label="Cookie consent"
  >
    <div
      class="mx-auto flex max-w-6xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <p class="text-sm text-gray-600 dark:text-gray-300">
        <strong class="text-gray-900 dark:text-white">We value your privacy.</strong>
        We use cookies to enhance your browsing experience, analyze site traffic, and understand
        where our visitors come from. By clicking <strong>&ldquo;Accept All&rdquo;</strong>, you consent
        to our use of cookies.
        <button
          type="button"
          class="underline hover:text-primary-600 dark:hover:text-primary-500"
          onclick={openPreferences}
        >
          Customize your preferences
        </button>
        at any time.
      </p>
      <div class="flex shrink-0 flex-wrap items-center gap-2">
        <Button size="sm" color="alternative" onclick={declineAll}>Decline</Button>
        <Button size="sm" color="alternative" onclick={openPreferences}>Customize</Button>
        <Button size="sm" color="primary" onclick={handleAcceptAll}>Accept All</Button>
      </div>
    </div>
  </div>
{/if}

<!-- transitionParams duration=0: the default fade outro never resolves on a
     native <dialog> promoted to the top layer, leaving it stuck open. -->
<Modal title="Cookie preferences" bind:open={modalOpen} transitionParams={{ duration: 0 }}>
  <p class="text-sm text-gray-600 dark:text-gray-300">
    We use cookies to keep this site running and, with your permission, to understand how it's
    used. Necessary cookies are always on; you're in control of the rest.
  </p>

  <div class="mt-4 space-y-4">
    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="font-medium text-gray-900 dark:text-white">Necessary</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Required for the site to function. Always on.
        </p>
      </div>
      <Toggle checked={true} disabled />
    </div>

    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="font-medium text-gray-900 dark:text-white">Analytics</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Google Analytics — helps us understand site traffic.
        </p>
      </div>
      <Toggle bind:checked={draftAnalytics} />
    </div>

    <div class="flex items-center justify-between gap-4">
      <div>
        <p class="font-medium text-gray-900 dark:text-white">Marketing</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          Meta (Facebook) Pixel — used to measure ad performance.
        </p>
      </div>
      <Toggle bind:checked={draftMarketing} />
    </div>
  </div>

  {#snippet footer()}
    <div class="flex w-full flex-wrap justify-end gap-2">
      <Button size="sm" color="alternative" onclick={handleSavePreferences}>
        Save preferences
      </Button>
      <Button size="sm" color="primary" onclick={handleAcceptAll}>Accept All</Button>
    </div>
  {/snippet}
</Modal>
