import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/svelte";

// jsdom doesn't implement matchMedia; flowbite-svelte's shared internals call
// it at import time (for responsive/dark-mode reactivity), so any component
// pulling in even a small slice of flowbite-svelte needs this stubbed.
if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}

// jsdom doesn't implement the Web Animations API; Svelte's transitions (e.g.
// Counter.svelte's `in:fly`/`out:fly`) call Element.animate to run them.
if (!Element.prototype.animate) {
  Element.prototype.animate = () =>
    ({
      finished: Promise.resolve(),
      cancel: () => {},
      play: () => {},
      pause: () => {},
      finish: () => {},
      onfinish: null,
      oncancel: null,
    }) as unknown as Animation;
}

afterEach(() => {
  cleanup();
});
