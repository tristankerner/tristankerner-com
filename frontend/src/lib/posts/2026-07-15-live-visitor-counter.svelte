<script module lang="ts">
  export const metadata = {
    title: "Building the Live Visitor Counter",
    author: "Tristan Kerner",
    excerpt: "How the little live counter on the home page stays in sync over a WebSocket.",
  };
</script>

<p>
  The counter on the home page ticks up in real time for every visitor connected to the
  site, backed by a small WebSocket endpoint on the actix-web server rather than a
  database or polling loop.
</p>

<p>
  Posts like this one are plain Svelte components, so they can use whatever the rest of
  the app can - components, reactive state, the works - not just prose. This one is the
  <code>.svelte</code> template option from <code>bun run new-post</code>, as opposed to
  the Markdown option used by the previous post.
</p>
