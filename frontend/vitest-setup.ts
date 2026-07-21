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

// jsdom doesn't implement the <dialog> element's interactive methods (used by
// flowbite-svelte's Modal, built on the native element rather than a div
// overlay); without these, showModal() throws and the modal can never open.
if (typeof HTMLDialogElement.prototype.showModal !== "function") {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.open = true;
  };
}
if (typeof HTMLDialogElement.prototype.show !== "function") {
  HTMLDialogElement.prototype.show = function (this: HTMLDialogElement) {
    this.open = true;
  };
}
if (typeof HTMLDialogElement.prototype.close !== "function") {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.open = false;
  };
}

// Node 22+ ships its own global `localStorage` accessor (behind an
// unset --localstorage-file flag) that throws/returns undefined until
// enabled. Vitest's jsdom environment aliases `window` to `global` and,
// since that built-in already occupies the `localStorage` key, never
// overwrites it with jsdom's real (working) Storage implementation -
// so every access hits Node's disabled stub instead. Replace it with a
// minimal in-memory Storage so code under test can use localStorage.
if (typeof globalThis.localStorage?.setItem !== "function") {
  const store = new Map<string, string>();
  const memoryStorage: Storage = {
    getItem: (key) => (store.has(key) ? store.get(key)! : null),
    setItem: (key, value) => void store.set(key, String(value)),
    removeItem: (key) => void store.delete(key),
    clear: () => void store.clear(),
    key: (index) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: memoryStorage,
    configurable: true,
    writable: true,
  });
}

afterEach(() => {
  cleanup();
});
