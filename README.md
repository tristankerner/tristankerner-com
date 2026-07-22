# tristankerner.com

Source for my personal site and blog: an actix-web/rustls backend serving a
statically-built SvelteKit frontend, plus a small WebSocket-based visitor
counter.

- [`src/`](src/) — Rust server (static file serving, TLS, the WS counter)
- [`frontend/`](frontend/) — SvelteKit site (blog, pages, components)
- [`deploy/`](deploy/) — deployment scripts
- [`Dockerfile`](Dockerfile) — runtime image assembled from prebuilt release
  artifacts (see [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml))

## Development

Backend:

```sh
cargo run
```

Frontend:

```sh
cd frontend
bun install
bun run dev
```

## License

This repository is dual-licensed:

- **Code** is licensed under the [MIT License](./LICENSE).
- **Blog post content and personal photographs** are licensed under
  [CC BY-NC-ND 4.0](./LICENSE-CONTENT) — you may share them with attribution,
  but not for commercial purposes or as modified/derivative works. Code
  snippets embedded within blog posts remain MIT-licensed.

See [LICENSE](./LICENSE) and [LICENSE-CONTENT](./LICENSE-CONTENT) for the
full terms and exact scope.
