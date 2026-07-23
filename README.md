# tristankerner.com

Source for my personal site and blog: an actix-web/rustls backend serving a
statically-built SvelteKit frontend, plus a small WebSocket-based visitor
counter. For less sloppy information on what this is: [Jump to Personal notes](#personal-notes)


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

## Testing and coverage

Both suites are gated at **90%** coverage in CI — see the "Frontend tests
with coverage" and "Server tests with coverage" steps in
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). A push to
`production` won't reach the image-build/deploy steps if either drops below
that.

### Backend (Rust)

```sh
cargo test                              # run the test suite
cargo install cargo-llvm-cov --locked   # one-time, if you don't already have it
cargo llvm-cov                          # run tests instrumented for coverage, print a summary
cargo llvm-cov --html                   # also write an HTML report to target/llvm-cov/html/index.html
```

CI runs `cargo llvm-cov --fail-under-lines 90 --fail-under-regions 90
--fail-under-functions 90`. Branch coverage isn't checked in CI — it needs
nightly Rust, which this project doesn't otherwise use.

### Frontend (SvelteKit)

```sh
cd frontend
bun run test        # vitest, single run
bun run test:watch  # vitest, watch mode
bun run coverage    # vitest run --coverage
```

Coverage thresholds (lines/statements/functions/branches, all 90%) are
configured in [`frontend/vite.config.ts`](frontend/vite.config.ts)
(`test.coverage.thresholds`). `bun run coverage` writes a report to
`frontend/coverage/index.html` in addition to the terminal summary.

## Scaffolding a new blog post

Posts are plain files under `frontend/src/lib/posts/`, discovered at build
time from their filename (`YYYY-MM-DD-title-slug.{md,svelte}`) — the CLI
just creates that one file with a starter template:

```sh
cd frontend
bun run new-post -- --title "My Post Title" --author "Tristan Kerner" --date 2026-07-19 --template md
```

- `--template` is `md` (YAML frontmatter + Markdown body) or `svelte` (a
  Svelte component exporting `metadata`) — see
  [`frontend/scripts/new-post.ts`](frontend/scripts/new-post.ts).
- All four flags (`--title`, `--author`, `--date`, `--template`) are
  required; `--date` must be a real `YYYY-MM-DD` calendar date, and the
  script refuses to overwrite an already-scaffolded post for the same
  date+title slug.
- Nothing else needs to be touched or regenerated — posts are picked up
  automatically by `bun run build` (via `import.meta.glob`), including the
  prerendered `/blog/[date]/[slug]` route and its entry in the paginated
  blog index.

## Deployment

[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on every
push to the `production` branch (or manually via `workflow_dispatch`) and
does the whole build-test-ship cycle in one job, with no container registry
involved:

1. **Build.** Frontend (`bun run build`, with the two `VITE_*` analytics IDs
   inlined from GitHub Actions variables) and backend (`cargo build
   --release`) are built directly on the runner, with dependency caching for
   both Bun and Cargo.
2. **Test + coverage gate.** Both suites run with coverage instrumentation;
   the job fails here — before anything is packaged or shipped — if either
   is under 90%. See [Testing and coverage](#testing-and-coverage) above.
3. **Image build.** The already-built `frontend/build` directory and the
   release binary are copied into a distroless runtime image (see
   [`Dockerfile`](Dockerfile)). Docker itself never compiles anything.
4. **Ship, no registry.** The image is `docker save`'d to a tarball and
   copied straight to the production GCP VM over an IAP-tunneled SSH
   connection (`gcloud compute scp` / `ssh --tunnel-through-iap`), so the VM
   never needs a public-facing port 22.
5. **Deploy on the VM.**
   [`deploy/remote-entrypoint.sh`](deploy/remote-entrypoint.sh) (run as
   root via `gcloud compute ssh ... --command`) loads the staged
   `deploy.env`, then hands off to [`deploy/run.sh`](deploy/run.sh), which:
   `docker load`s the image, issues a Let's Encrypt certificate on first run
   (DNS-01 via Cloudflare — skipped if one already exists under
   `$STATE_DIR`), keeps a `certbot-renew` sidecar container running for
   renewals, copies a staged GA4 service-account key into `$STATE_DIR` if
   one was provided, and stops/recreates the app container in place with
   the visitor counter's sqlite directory (`$STATE_DIR/data`, see
   [`src/store.rs`](src/store.rs)) mounted read-write. `$STATE_DIR` (the
   cert, GA4-key, and visitor-data volume) is never touched by a redeploy
   other than that GA4-key copy, and the staged deploy files (including
   the Cloudflare token and the GA4 key) are deleted on the VM whether the
   deploy succeeds or fails.

The comment block at the top of `.github/workflows/deploy.yml` documents the
one-time GCP-side setup this all assumes is already in place (OS Login,
firewall rule for the IAP range, service account + roles) — also summarized
under [Environment variables](#environment-variables) below.



## Environment variables

Variables here show up in three different shapes:

- **Standard env vars** — read directly by the Rust binary, Vite, or
  `deploy/run.sh`; set via a `.env` file, `-e`/`--env-file` on `docker run`,
  or the shell environment. Not sensitive on their own, except where noted.
- **GitHub Actions repository variables** (`vars.*` — repo Settings →
  Secrets and variables → Actions → **Variables** tab) — non-secret CI
  configuration.
- **GitHub Actions repository secrets** (`secrets.*` — same page,
  **Secrets** tab) — masked in logs, used only for credentials.

### Backend runtime (standard env vars)

| Variable | Required | Default | Set in | Description |
|---|---|---|---|---|
| `HOST` | optional | `127.0.0.1` locally; `0.0.0.0` in Docker/on the VM | `.env` locally (see [`.env.example`](.env.example)); `ENV HOST=0.0.0.0` in [`Dockerfile`](Dockerfile); `-e HOST=0.0.0.0` in [`deploy/run.sh`](deploy/run.sh) | Bind address for the actix-web listener. Must stay `0.0.0.0` in the container for the `-p` port mapping to reach the process. |
| `PORT` | optional | `8080` locally; `80` in Docker/on the VM (`$CONTAINER_PORT`) | same as above | Plain-HTTP bind port. |
| `TLS_CERT_PATH` | optional | unset (TLS disabled) | `.env` locally, or `-e` on `docker run` (see [`deploy/run.sh`](deploy/run.sh)) | Path to a `fullchain.pem`. Set together with `TLS_KEY_PATH` to have this process terminate TLS itself, e.g. pointed at a certbot-managed cert. |
| `TLS_KEY_PATH` | optional | unset | same | Path to the matching `privkey.pem`. |
| `TLS_PORT` | optional | `443` | same | HTTPS bind port; only used once `TLS_CERT_PATH`/`TLS_KEY_PATH` are both set. |
| `VISITOR_DB_PATH` | optional | `./visitors.db` locally; `/data/visitors.db` in Docker/on the VM | `.env` locally; `ENV VISITOR_DB_PATH=/data/visitors.db` in [`Dockerfile`](Dockerfile); `-v .../data:/data` volume in [`deploy/run.sh`](deploy/run.sh) | Sqlite database backing the visitor counter (see [`src/store.rs`](src/store.rs)): long-term GA4 totals plus this site's own self-tracked page-serve hits. Created (including parent directories) on first run. |
| `APP_ENV` | optional | unset (dev) | `.env` locally; `ENV APP_ENV=production` in [`Dockerfile`](Dockerfile) | Set to `production` to have the daily GA4 sync (see [`src/ws_counter.rs`](src/ws_counter.rs)) populate the long-term totals via [`src/ga4.rs`](src/ga4.rs). Any other value (including unset) just leaves the long-term table empty — the page-serve self-tracking (see [`src/static_files.rs`](src/static_files.rs)) runs regardless of this setting. Either way, the ticker only broadcasts on ticks where at least one browser has `/ws-counter` open. |
| `VISITOR_TICK_INTERVAL_MINUTES` | optional | `1` | `.env` locally, or `-e` on `docker run` | How often (in whole minutes) the ticker wakes up to check for active connections and, if any exist, recompute and broadcast the combined total. A missing, zero, or unparseable value falls back to `1`. |
| `GOOGLE_APPLICATION_CREDENTIALS` | optional | unset (GA4 querying disabled) | `.env` locally, or `-e`/mounted file on `docker run` (see [`deploy/run.sh`](deploy/run.sh)) | Path to a GCP service-account JSON key. Only read when `APP_ENV=production`; the standard GCP client-library env var name, so it also works with other Google tooling unmodified. |
| `GA4_PROPERTY_ID` | optional | unset (GA4 querying disabled) | same | Numeric GA4 property ID the daily sync queries. Required alongside `GOOGLE_APPLICATION_CREDENTIALS` for GA4 querying to actually happen. |
| `GA4_TOP_PAGES_LIMIT` | optional | `50` | same | How many of the most-visited pages (by total users, descending) the daily sync's all-time query tracks — not a fixed list of pages, so the set can change as traffic does. A missing, zero, or unparseable value falls back to `50`. |
| `TRUST_CF_CONNECTING_IP` | optional | unset (untrusted) | `.env` locally, or `-e` on `docker run` | Set to `true` to have the visitor tracker (see [`src/visitor_key.rs`](src/visitor_key.rs)) key visits off the `CF-Connecting-IP` header instead of the TCP peer address. See [Running behind Cloudflare](#running-behind-cloudflare) below before enabling this. |
| `RUST_LOG` | optional | unset (no output) locally; `info` in Docker/on the VM | `.env` locally; `ENV RUST_LOG=info` in [`Dockerfile`](Dockerfile) | Standard `env_logger`/`log` filter syntax (e.g. `info`, `debug`, or `actix_web=info,tristankerner_com=debug`) controlling HTTP access logs (actix-web's `middleware::Logger`) and this crate's own `warn!`/`error!` calls. `env_logger` prints nothing at all if this is unset. |

The TLS variables need no external permissions — purely local process
configuration, with cert/key files re-read whenever their mtime changes so
certbot renewals don't require a restart. `GOOGLE_APPLICATION_CREDENTIALS`
is different: the service account behind that key must be granted
**Viewer** access on the `GA4_PROPERTY_ID` property (GA4 Admin → Property
Access Management) before the daily sync can read anything from it.

### Running behind Cloudflare

If this server ends up behind Cloudflare (proxied/"orange-cloud" DNS)
rather than answering requests directly, every connection the app sees
arrives from Cloudflare's edge, not the visitor — `req.peer_addr()` would
report Cloudflare's IP for everyone. Cloudflare passes the real client IP
through in the `CF-Connecting-IP` header instead.

Trusting that header is only safe if the origin *cannot* be reached any
other way: since it's an ordinary request header, anyone who can connect to
the origin directly (bypassing Cloudflare) can send an arbitrary
`CF-Connecting-IP` value and spoof any IP they like, which would let
someone trivially inflate the visitor counter or evade the deduplication
in [`src/visitor_key.rs`](src/visitor_key.rs). So:

1. Firewall the origin (e.g. the GCP VM's firewall rules) to only accept
   inbound traffic on `HTTP_PORT`/`HTTPS_PORT` from
   [Cloudflare's published IP ranges](https://www.cloudflare.com/ips/).
2. Only then set `TRUST_CF_CONNECTING_IP=true`.

Leaving it unset is always safe (and is the default) — the app behaves
exactly as if there were no proxy in front of it, using the TCP peer
address. The `Origin`/`Host`-based same-origin check on the `/ws-counter`
WebSocket upgrade (see [`src/ws_counter.rs`](src/ws_counter.rs)) is
unaffected either way, since Cloudflare passes both of those through
unchanged.

### Frontend build-time (Vite, `VITE_`-prefixed)

| Variable | Required | Default | Set in | Description |
|---|---|---|---|---|
| `VITE_GOOGLE_ANALYTICS_ID` | optional | `G-XXXXXXXXXX` placeholder | `frontend/.env.local` locally (copy from [`frontend/.env.example`](frontend/.env.example)); in CI, exported from the `GOOGLE_ANALYTICS_ID` repo variable before `bun run build` | GA4 measurement ID used in [`frontend/src/lib/consent/config.ts`](frontend/src/lib/consent/config.ts). |
| `VITE_FACEBOOK_PIXEL_ID` | optional | `0000000000000000` placeholder | same, from the `FACEBOOK_PIXEL_ID` repo variable | Meta Pixel ID, same file. |

No external permissions needed — both are public, client-side tracking IDs
(they ship in the built JS regardless of how they're set), which is why
they're plain repository variables rather than secrets. Leaving them unset
just means the placeholder IDs are compiled in.

### GitHub Actions — repository variables (`vars.*`, non-secret)

| Variable | Required for deploy | Default | Description |
|---|---|---|---|
| `GOOGLE_ANALYTICS_ID` | optional | none (placeholder used) | Injected into the frontend build as `VITE_GOOGLE_ANALYTICS_ID`. |
| `FACEBOOK_PIXEL_ID` | optional | none (placeholder used) | Injected into the frontend build as `VITE_FACEBOOK_PIXEL_ID`. |
| `IMAGE_NAME` | optional | `tristankerner-com` | Docker image tag built in CI and loaded on the VM. |
| `DOMAIN` | **required** | — | Domain the TLS certificate is issued for, and the vhost the app answers on. |
| `LETSENCRYPT_EMAIL` | **required** | — | Contact address registered with Let's Encrypt for expiry/urgent notices. |
| `STATE_DIR` | optional | `/var/lib/tristankerner` | Persistent, writable directory on the VM holding certbot's state; survives redeploys. |
| `CONTAINER_NAME` | optional | `tristankerner-com` | Name of the running app container on the VM. |
| `HTTP_PORT` | optional | `80` | Host port on the VM mapped to the container's HTTP port. |
| `HTTPS_PORT` | optional | `443` | Host port on the VM mapped to the container's HTTPS port. |
| `CONTAINER_PORT` | optional | `80` | Port the app listens on *inside* the container (becomes its `PORT`). |
| `CONTAINER_TLS_PORT` | optional | `443` | Port the app listens on for TLS *inside* the container (becomes its `TLS_PORT`). |
| `GCP_PROJECT_ID` | **required** | — | GCP project hosting the target VM. |
| `GCP_ZONE` | **required** | — | Compute Engine zone of the target VM. |
| `GCP_INSTANCE_NAME` | **required** | — | Compute Engine instance name of the target VM. |
| `GA4_PROPERTY_ID` | optional | none (GA4 querying disabled) | Numeric GA4 property ID; written into `deploy.env` and passed to the app container as `GA4_PROPERTY_ID` (see [Backend runtime](#backend-runtime-standard-env-vars) above). |
| `GA4_TOP_PAGES_LIMIT` | optional | `50` (set by the app itself) | How many top pages to request; written into `deploy.env` and passed to the app container as `GA4_TOP_PAGES_LIMIT` only when set (see [Backend runtime](#backend-runtime-standard-env-vars) above). |
| `VISITOR_TICK_INTERVAL_MINUTES` | optional | `1` (set by the app itself) | How often the ticker checks for active connections/refreshes counts; written into `deploy.env` and passed to the app container as `VISITOR_TICK_INTERVAL_MINUTES` only when set (see [Backend runtime](#backend-runtime-standard-env-vars) above). |
| `TRUST_CF_CONNECTING_IP` | optional | unset (untrusted) | Whether to trust the `CF-Connecting-IP` header for visitor tracking; written into `deploy.env` and passed to the app container only when set. **Do not set this without also restricting the GCP firewall to Cloudflare's IP ranges** — see [Running behind Cloudflare](#running-behind-cloudflare) above. |

**External permissions:** none directly — these are plain config values.
`GCP_PROJECT_ID`/`GCP_ZONE`/`GCP_INSTANCE_NAME` just need to correctly
identify a VM that the service account behind `GCP_SA_KEY` (below) can
reach. Separately, the GCP firewall must allow public ingress on whichever
ports `HTTP_PORT`/`HTTPS_PORT` resolve to — that's the actual web traffic,
distinct from the IAP/SSH firewall rule described below.

### GitHub Actions — repository secrets (`secrets.*`)

| Variable | Required for deploy | Description | External permissions needed |
|---|---|---|---|
| `GCP_SA_KEY` | **required** | JSON key for a dedicated GCP service account, used by `google-github-actions/auth` to authenticate `gcloud` for the SSH/SCP-over-IAP steps. | On the target project (or just the instance), grant the service account: `roles/iap.tunnelResourceAccessor` (open the IAP tunnel used for SSH/SCP), `roles/compute.osAdminLogin` (SSH in via OS Login *with* sudo — needed to run `docker` as root on Container-Optimized OS), `roles/compute.viewer` (resolve the instance's zone/IP by name). Also requires one-time setup: OS Login enabled on the project/instance (`enable-oslogin=TRUE` metadata) and a firewall rule allowing `tcp:22` from `35.235.240.0/20` only (the IAP forwarding range, not the public internet). |
| `CLOUDFLARE_API_TOKEN` | **required** | Used by certbot's `dns-cloudflare` plugin for the Let's Encrypt DNS-01 challenge. Written into `deploy.env` as a real env var (never interpolated into shell text, never echoed) and deleted from the VM on exit regardless of deploy outcome. | A Cloudflare **API Token** (not the legacy Global API Key) scoped to `Zone:DNS:Edit` for `DOMAIN`'s zone only — create via My Profile → API Tokens → Create Token → "Edit zone DNS" template, restricted to that one zone. |
| `GA4_CREDENTIALS_JSON` | optional | Full JSON contents of a GCP service-account key, used by the visitor ticker to query GA4 (see [`src/ga4.rs`](src/ga4.rs)). Written to its own `ga4-credentials.json` file on the runner (never folded into `deploy.env`, since it's multi-line), staged to the VM alongside `deploy.env`, copied into persistent storage by [`deploy/run.sh`](deploy/run.sh), then deleted from both the runner and the VM's staging directory regardless of deploy outcome. Leaving it unset keeps GA4 querying disabled even with `APP_ENV=production`. | A dedicated GCP service account (separate from the one behind `GCP_SA_KEY` — this one only ever needs GA4 read access, never IAP/SSH) granted **Viewer** on the `GA4_PROPERTY_ID` property (GA4 Admin → Property Access Management), with a JSON key created for it. |

## Personal notes

This website started as a learning project. An interesting (_that doesn't mean good_) architecture choice used
to learn an unfamiliar language (Rust), with a new (to me) frontend (SvelteKit). I've already
worked with other languages (both front and back end), but it's always exciting to
learn something new. The goal was simple: Use Svelte along with Tailwind/Flowbite/Vite,
that I'm already familiar with, for the front end. For the backend, Rust, with a web
framework (actix-web in this case). Serve the static files directly--no nginx
in front, with the only initial/other functionality being an integration with Google Analytics 
to power an old-school web counter. Those were little odometer style counters that were around
back when I was first learning HTML--they weren't too smart though. This one would update 
live-ish via websockets, and Google Analytics is probably a little better about counting.

All that said, at the time of writing this, the most valuable skill I could learn, is using AI 
to code in my daily process. So, what was a small project meant to learn a new language/framework, 
turned into using Claude generate code most of this code, and then me reviewing that code, in those new 
to me languages/frameworks. 

I definitely had ways that I wanted this to work, so I was somewhat specific in my prompting, for better
or worse. This hasn't been deployed yet, but we'll see how that goes soon.

I've set the code as MIT license, though I'm not sure that it would have any value for others. It
was also mostly AI "writing" the code (and the licensing), so take that for what it's worth. 
Written and image assets intended to be displayed (such as this section of text, home page text, blog 
text, resume text, etc.) should be under the linked CC BY-NC-ND 4.0 content license. 

So, dear reader, if for some mysterious reason you see some value in forking this repo for your own 
uses, certainly feel free to follow the MIT license guidelines. Just remember to swap in all your own content.

## License

This repository is dual-licensed:

- **Code** is licensed under the [MIT License](./LICENSE).
- **Page content, blog post content and personal photographs** are licensed under
  [CC BY-NC-ND 4.0](./LICENSE-CONTENT) — you may share them with attribution,
  but not for commercial purposes or as modified/derivative works. Code
  snippets embedded within blog posts remain MIT-licensed.

See [LICENSE](./LICENSE) and [LICENSE-CONTENT](./LICENSE-CONTENT) for the
full terms and exact scope.
