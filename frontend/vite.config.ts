/// <reference types="vitest/config" />
import { mdsvex } from "mdsvex";
import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Vitest runs component tests through vite-node's SSR module pipeline,
  // which without this would make vite-plugin-svelte compile .svelte files
  // as server components (SSR-render only, no mount/effects) instead of
  // client components - the documented fix for testing Svelte components
  // with Vitest. https://svelte.dev/docs/svelte/testing
  resolve: process.env.VITEST ? { conditions: ["browser"] } : undefined,
  server: {
    // In production this is served by the same actix-web origin as the rest of the
    // site; proxy it here so `vite dev` can talk to a locally running backend too.
    proxy: {
      "/ws-counter": {
        target: "http://127.0.0.1:8080",
        ws: true,
      },
    },
  },
  plugins: [
    tailwindcss(),
    sveltekit({
      compilerOptions: {
        // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
        runes: ({ filename }) =>
          filename.split(/[/\\]/).includes("node_modules") ? undefined : true,
      },

      // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
      // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
      // See https://svelte.dev/docs/kit/adapters for more information about-me adapters.
      adapter: adapter({
        // default options are shown. On some platforms
        // these options are set automatically — see below
        pages: "build",
        assets: "build",
        fallback: undefined,
        precompress: true,
        strict: true,
      }),
      output: {
        // 'split' keeps each route (and each lazily imported blog post) in its
        // own hashed chunk under /_app/immutable/, which the actix server
        // already serves with long-lived immutable cache headers. 'inline'
        // duplicated the entire app bundle into every prerendered HTML page.
        bundleStrategy: "split",
      },
      prerender: {
        // /blog/page/[page] legitimately has zero prerendered instances once
        // there are POSTS_PER_PAGE or fewer posts (page 1 lives at /blog
        // itself) - only that route is allowed to go unseen, everything else
        // still fails the build as before.
        handleUnseenRoutes: (details) => {
          const unexpected = details.routes.filter((id) => id !== "/blog/page/[page]");
          if (unexpected.length > 0) {
            throw new Error(`Unseen prerenderable routes: ${unexpected.join(", ")}`);
          }
        },
      },
      preprocess: [mdsvex({ extensions: [".svx", ".md"], smartypants: true })],
      extensions: [".svelte", ".svx", ".md"],
      typescript: {
        config(config) {
          if (config.include) {
            config.include.push("src/global.d.ts");
          }
        },
      },
    }),
  ],
  test: {
    environment: "jsdom",
    // vitest's jsdom environment defaults to executing injected <script>
    // tags for browser fidelity (e.g. flowbite-svelte's FOUC-prevention
    // dark-mode snippet). That runs outside our module graph (so our
    // window.matchMedia polyfill below doesn't reach it) and isn't needed
    // for testing component logic through Svelte's own render/effects.
    environmentOptions: { jsdom: { runScripts: "outside-only" } },
    setupFiles: ["./vitest-setup.ts"],
    include: ["src/**/*.{test,spec}.{js,ts}", "scripts/**/*.{test,spec}.{js,ts}"],
    // new-post.test.ts transiently writes into the real src/lib/posts/
    // directory (and posts.ts scans that same directory via
    // import.meta.glob at import time); run test files serially so that
    // never races with another file's glob scan.
    fileParallelism: false,
    coverage: {
      provider: "v8",
      all: true,
      include: ["src/**/*.{ts,svelte}", "scripts/**/*.ts"],
      exclude: [
        // Ambient type declarations and empty barrel files have no executable
        // statements to cover.
        "src/app.d.ts",
        "src/global.d.ts",
        "src/lib/index.ts",
        // Blog post content, not application logic.
        "src/lib/posts/**",
        "**/*.d.ts",
      ],
      thresholds: {
        lines: 90,
        statements: 90,
        functions: 90,
        branches: 90,
      },
      reporter: ["text", "json-summary", "html"],
    },
  },
});
