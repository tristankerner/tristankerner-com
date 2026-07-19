import type { Component } from "svelte";

// Lazy glob only - this is the sole blog module reachable from client code,
// so each post's content compiles to its own chunk that the browser fetches
// only on that post's page. Metadata lives in posts.ts (server/build only).
const componentModules = import.meta.glob<{ default: Component }>(
  "/src/lib/posts/*.{md,svx,svelte}",
);

export async function loadPostComponent(path: string): Promise<Component> {
  const loader = componentModules[path];
  if (!loader) {
    throw new Error(`No post component module at "${path}".`);
  }
  return (await loader()).default;
}
