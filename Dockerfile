# syntax=docker/dockerfile:1

# The frontend (frontend/build/) and the server release binary
# (target/release/tristankerner-com) are built on the GitHub Actions runner,
# not here (see .github/workflows/deploy.yml) - that's where dependency
# caching and the 90%+ test coverage gate live. This Dockerfile only
# assembles the runtime image from those already-built artifacts, so
# `docker build .` requires both to already exist in the build context.
#
# Distroless: no shell, package manager, or other OS tooling - just glibc +
# libgcc (this binary's only two dynamic deps, confirmed via ldd) to run it
# alongside the static frontend build. Root, not :nonroot, since
# deploy/run.sh binds this container to 80/443 directly, which needs
# CAP_NET_BIND_SERVICE that uid 65532 wouldn't have.
FROM gcr.io/distroless/cc-debian12
WORKDIR /app
COPY target/release/tristankerner-com ./tristankerner-com
COPY frontend/build ./frontend/build

ENV HOST=0.0.0.0
ENV PORT=80

# This image is only ever the production runtime (see deploy/run.sh), so the
# visitor ticker's GA4 querying is unconditionally enabled here rather than
# left to be set per-`docker run`. Only takes effect once
# GOOGLE_APPLICATION_CREDENTIALS/GA4_PROPERTY_ID are also set - see the GA4
# comment below and src/ga4.rs.
ENV APP_ENV=production

# Sqlite storage for the visitor counter (see src/store.rs): long-term GA4
# totals plus this site's own self-tracked page-serve hits that bridge the
# gap until the next daily GA4 sync. Always core, always-on infrastructure
# for the counter feature - unlike TLS/GA4 below, there's no way to turn
# this off. `/data` must be a *directory* bind mount, not a single-file one:
# sqlite's WAL mode writes `-wal`/`-shm` sidecar files next to the main .db
# file, and those need to persist too or a container restart can lose
# recently committed data. deploy/run.sh mounts this read-write and never
# deletes it on redeploy. e.g.:
#
#   docker run \
#     -v tristankerner-visitor-data:/data \
#     -p 80:80 -p 443:443 tristankerner-com
ENV VISITOR_DB_PATH=/data/visitors.db

# env_logger prints nothing at all unless a filter is set, so this gives the
# production image a sane default (access logs via actix-web's
# middleware::Logger, plus this crate's own warn!/error! calls) without
# requiring an operator to remember to set it. Override with -e RUST_LOG=...
# for more/less verbosity (e.g. debug, or actix_web=info,tristankerner_com=debug).
ENV RUST_LOG=info

# TLS is opt-in (see src/main.rs): set TLS_CERT_PATH/TLS_KEY_PATH to a
# certbot-managed fullchain.pem/privkey.pem to have this process terminate
# HTTPS itself and redirect plain HTTP to it. e.g., with a certbot container
# (dns-cloudflare plugin) writing into a shared volume:
#
#   docker run \
#     -v certbot-etc:/etc/letsencrypt:ro \
#     -e TLS_CERT_PATH=/etc/letsencrypt/live/<domain>/fullchain.pem \
#     -e TLS_KEY_PATH=/etc/letsencrypt/live/<domain>/privkey.pem \
#     -p 80:80 -p 443:443 tristankerner-com
#
# The cert/key are re-read on their mtime changing, so certbot's renewal
# doesn't require restarting this container. Leave both env vars unset to
# serve plain HTTP only (e.g. behind an external TLS-terminating proxy).
#
# GA4 querying (see src/ga4.rs) is opt-in the same way: set
# GOOGLE_APPLICATION_CREDENTIALS to a mounted service-account JSON key and
# GA4_PROPERTY_ID to the numeric property ID to have the daily sync pull
# real lifetime-distinct totals per page into the sqlite database above,
# instead of the counter running on self-tracked short-term data alone.
# GA4_TOP_PAGES_LIMIT optionally caps how many pages the all-time query
# tracks (default 50). e.g.:
#
#   docker run \
#     -v ga4-credentials.json:/etc/ga4/credentials.json:ro \
#     -e GOOGLE_APPLICATION_CREDENTIALS=/etc/ga4/credentials.json \
#     -e GA4_PROPERTY_ID=123456789 \
#     -e GA4_TOP_PAGES_LIMIT=50 \
#     -p 80:80 -p 443:443 tristankerner-com
#
# The key is never baked into this image or committed to the repo - it's
# supplied at deploy time (see deploy/run.sh) the same way TLS certs are.
EXPOSE 80 443

ENTRYPOINT ["./tristankerner-com"]
