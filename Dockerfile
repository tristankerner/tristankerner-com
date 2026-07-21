# syntax=docker/dockerfile:1

FROM oven/bun:1.3.14 AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package.json frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY frontend/ ./
RUN bun run build

FROM rust:1.96.0-slim-bookworm AS server-builder
WORKDIR /app
COPY Cargo.toml Cargo.lock ./
RUN mkdir src && echo "fn main() {}" > src/main.rs \
    && cargo build --release \
    && rm -rf src
COPY src ./src
RUN touch src/main.rs && cargo build --release

FROM debian:bookworm-slim
WORKDIR /app
COPY --from=server-builder /app/target/release/tristankerner-com ./tristankerner-com
COPY --from=frontend-builder /app/frontend/build ./frontend/build

ENV HOST=0.0.0.0
ENV PORT=80

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
EXPOSE 80 443

ENTRYPOINT ["./tristankerner-com"]
