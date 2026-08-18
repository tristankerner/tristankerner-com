// vitest-setup.ts (project root) registers these matchers at runtime, but
// lives outside src/ so SvelteKit's generated tsconfig never includes it -
// importing here (src/**/*.ts is always included) is what makes the
// augmented `expect(...).toBeInTheDocument()` etc. type-check.
import "@testing-library/jest-dom/vitest";

declare module "*.md" {
  import type { SvelteComponent } from "svelte";

  export default class Comp extends SvelteComponent {}

  export const metadata: Record<string, unknown>;
}
