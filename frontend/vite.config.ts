import { mdsvex } from "mdsvex";
import tailwindcss from "@tailwindcss/vite";
import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

export default defineConfig({
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
});
